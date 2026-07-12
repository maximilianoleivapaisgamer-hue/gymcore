"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import type { RealPlan } from "@/types/db";

/**
 * Planes reales del gimnasio: lo que efectivamente se le cobra a cada socio.
 * Se usan como lista de selección en Socios (alta/cobro). Cada plan puede
 * tildarse para sincronizarse automáticamente con la landing pública — si no
 * se tilda, la landing sigue mostrando sus propios planes de marketing
 * (configurados aparte en Mi página).
 */
export default function PlanesPage() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [plans, setPlans] = useState<RealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
    setGymId(profile?.gym_id ?? null);
    if (profile?.gym_id) {
      const { data } = await supabase
        .from("gyms").select("real_plans").eq("id", profile.gym_id)
        .single<{ real_plans: RealPlan[] }>();
      setPlans(data?.real_plans || []);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function addPlan() {
    setPlans((ps) => [...ps, { name: "", price: 0, detail: "", sync_landing: false }]);
  }
  function setPlan(i: number, patch: Partial<RealPlan>) {
    setPlans((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function removePlan(i: number) {
    setPlans((ps) => ps.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!gymId) return;
    setSaving(true);
    setMsg("");
    const { error } = await supabase.from("gyms").update({ real_plans: plans }).eq("id", gymId);
    setSaving(false);
    setMsg(error ? "No se pudo guardar" : "¡Planes guardados!");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link>
            <span>/</span><span>Planes</span>
          </div>
          <h1 className="text-2xl font-bold">Planes</h1>
          <p className="text-ink-2">
            Los planes reales que le cobrás a tus socios. Se usan en Socios para dar de alta y cobrar cuotas.
          </p>
        </div>
        <button className="btn btn-primary" onClick={addPlan}>+ Agregar plan</button>
      </div>

      {loading ? (
        <p className="p-8 text-center text-ink-2">Cargando…</p>
      ) : (
        <div className="card">
          {plans.length === 0 && (
            <p className="mb-3 text-sm text-muted">
              Todavía no cargaste planes. Agregá al menos uno para poder seleccionarlo al dar de alta un socio.
            </p>
          )}
          <div className="space-y-3">
            {plans.map((p, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Nombre del plan (ej: Musculación)"
                    value={p.name}
                    onChange={(e) => setPlan(i, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removePlan(i)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 text-sm text-ink-2 hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted">$</span>
                    <input
                      type="number"
                      className="input w-28"
                      placeholder="Precio"
                      value={p.price || ""}
                      onChange={(e) => setPlan(i, { price: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <input
                    className="input min-w-[180px] flex-1"
                    placeholder="Detalle (opcional)"
                    value={p.detail}
                    onChange={(e) => setPlan(i, { detail: e.target.value })}
                  />
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink-2">
                    <input
                      type="checkbox"
                      checked={p.sync_landing}
                      onChange={(e) => setPlan(i, { sync_landing: e.target.checked })}
                    />
                    Mostrar en mi página
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar planes"}
            </button>
            {msg && <span className="text-sm text-brand">{msg}</span>}
          </div>
          <p className="mt-4 text-xs text-muted">
            Si un plan no está tildado, tu página pública sigue mostrando los planes de marketing configurados en{" "}
            <Link href="/dashboard/configuracion" className="text-brand">Mi página</Link> (podés poner ahí un precio
            promocional distinto al que cobrás de verdad).
          </p>
        </div>
      )}
    </main>
  );
}
