"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { loadPlans, ALL_FEATURES, type PlanConfig, type PlanFeature } from "@/lib/plans";
import { money } from "@/lib/admin";

export default function PlanesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [planCfgs, setPlanCfgs] = useState<PlanConfig[]>([]);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [planMsg, setPlanMsg] = useState("");

  useEffect(() => {
    (async () => {
      setPlanCfgs(await loadPlans(supabase));
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  function setPlanField(key: string, patch: Partial<PlanConfig>) {
    setPlanCfgs((cs) => cs.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }
  function toggleCap(key: string, cap: PlanFeature) {
    setPlanCfgs((cs) => cs.map((p) => (p.key === key
      ? { ...p, capabilities: p.capabilities.includes(cap) ? p.capabilities.filter((c) => c !== cap) : [...p.capabilities, cap] }
      : p)));
  }
  async function savePlan(p: PlanConfig) {
    setSavingPlan(p.key); setPlanMsg("");
    const { error } = await supabase.from("plan_configs").update({
      label: p.label, tagline: p.tagline, price: p.price,
      promo_price: p.promo_price, promo_note: p.promo_note,
      featured: p.featured, features: p.features, capabilities: p.capabilities,
      updated_at: new Date().toISOString(),
    }).eq("key", p.key);
    setSavingPlan(null);
    setPlanMsg(error ? `No se pudo guardar (${error.message})` : `Plan ${p.label} guardado ✓`);
  }

  if (loading) return <div className="grid min-h-[50vh] place-items-center text-ink-2">Cargando…</div>;

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Planes de turnogym</h1>
        {planMsg && <span className="text-sm text-brand">{planMsg}</span>}
      </div>
      <p className="mb-6 text-ink-2">
        Editá precio, textos, beneficios y qué funciones desbloquea cada plan. Los cambios se aplican en todo el
        sistema (el “Mi Plan” de cada dueño y los candados de las funciones).
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {planCfgs.map((p) => (
          <div key={p.key} className="rounded-xl border border-white/10 bg-surface-2 p-4">
            <div className="mb-3 flex items-center justify-between">
              <input
                className="input h-8 w-32 py-0 text-sm font-bold"
                value={p.label}
                onChange={(e) => setPlanField(p.key, { label: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-ink-2">
                <input type="checkbox" checked={p.featured} onChange={(e) => setPlanField(p.key, { featured: e.target.checked })} />
                Destacado
              </label>
            </div>

            <label className="mb-1 block text-[11px] font-semibold text-ink-2">Bajada</label>
            <input className="input mb-2 h-8 py-0 text-xs" value={p.tagline} onChange={(e) => setPlanField(p.key, { tagline: e.target.value })} />

            <div className="mb-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-ink-2">Precio/mes</label>
                <input type="number" className="input h-8 py-0 text-xs" value={p.price || ""} onChange={(e) => setPlanField(p.key, { price: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-ink-2">Promo 1er mes</label>
                <input type="number" className="input h-8 py-0 text-xs" placeholder="—" value={p.promo_price ?? ""} onChange={(e) => setPlanField(p.key, { promo_price: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>

            <label className="mb-1 block text-[11px] font-semibold text-ink-2">Aclaración de la promo</label>
            <input className="input mb-2 h-8 py-0 text-xs" placeholder="—" value={p.promo_note ?? ""} onChange={(e) => setPlanField(p.key, { promo_note: e.target.value || null })} />

            <label className="mb-1 block text-[11px] font-semibold text-ink-2">Beneficios (uno por línea)</label>
            <textarea
              className="input mb-2 text-xs"
              rows={5}
              value={(p.features || []).join("\n")}
              onChange={(e) => setPlanField(p.key, { features: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
            />

            <label className="mb-1 block text-[11px] font-semibold text-ink-2">Funciones que desbloquea</label>
            <div className="mb-3 space-y-1">
              {ALL_FEATURES.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-xs text-ink-2">
                  <input type="checkbox" checked={p.capabilities.includes(f.key)} onChange={() => toggleCap(p.key, f.key)} />
                  {f.label}
                </label>
              ))}
            </div>

            <button className="btn btn-primary w-full" disabled={savingPlan === p.key} onClick={() => savePlan(p)}>
              {savingPlan === p.key ? "Guardando…" : "Guardar plan"}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Ojo: si a un plan le sacás una función, los gimnasios en ese plan dejan de verla al instante.
        Precios actuales: {planCfgs.map((p) => `${p.label} ${money(p.price)}`).join(" · ")} por mes.
      </p>
    </div>
  );
}
