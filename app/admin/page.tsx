"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { loadPlans, ALL_FEATURES, type PlanConfig, type PlanFeature } from "@/lib/plans";
import { BrandMark } from "@/components/BrandMark";

interface Gym { id: string; name: string; slug: string; owner_id: string; created_at: string; whatsapp: string | null; }
interface Sub { gym_id: string; plan: "basico" | "pro" | "elite"; status: "trial" | "active" | "past_due" | "canceled"; trial_ends_at: string | null; current_period_end: string | null; }
interface Profile { id: string; full_name: string | null; }

/** Precios de TU abono mensual por plan (lo que cobrás a cada dueño de gimnasio). Editá estos valores. */
const PLAN_PRICES: Record<string, number> = { basico: 49000, pro: 79000, elite: 119000 };
const PLAN_LABEL: Record<string, string> = { basico: "Básico", pro: "Pro", elite: "Elite" };

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Activo", cls: "bg-[rgba(34,197,94,.14)] text-good" },
  trial: { label: "Trial", cls: "bg-[rgba(34,211,238,.14)] text-brand" },
  past_due: { label: "Impago", cls: "bg-[rgba(245,177,61,.14)] text-warn" },
  canceled: { label: "Cancelado", cls: "bg-[rgba(240,82,82,.14)] text-crit" },
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const fdate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-AR") : "—");

/** Arma el link de WhatsApp con un mensaje según el estado del gimnasio. */
function waLink(gym: Gym, sub: Sub | undefined, ownerFirst: string): string | null {
  const phone = (gym.whatsapp || "").replace(/\D/g, "");
  if (!phone) return null;
  const hola = ownerFirst ? `¡Hola ${ownerFirst}!` : "¡Hola!";
  const plan = sub ? PLAN_LABEL[sub.plan] : "";
  const vence = sub ? fdate(sub.status === "trial" ? sub.trial_ends_at : sub.current_period_end) : "";
  let msg: string;
  if (sub?.status === "trial") {
    msg = `${hola} Te escribo de turnogym 👋 Tu prueba gratis vence el ${vence}. Si querés seguir, activamos tu plan ${plan} y listo. ¿Lo dejamos andando?`;
  } else if (sub?.status === "past_due") {
    msg = `${hola} Te escribo de turnogym. Nos figura un pago pendiente de tu plan ${plan}. ¿Coordinamos para regularizarlo y que no se te corte el servicio?`;
  } else if (sub?.status === "canceled") {
    msg = `${hola} Te escribo de turnogym. Vimos que tu plan quedó dado de baja; si querés reactivarlo, te lo dejo andando en un toque.`;
  } else {
    msg = `${hola} Te escribo de turnogym para ver cómo venís con el sistema. ¿Necesitás una mano con algo?`;
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export default function AdminPage() {
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "denied" | "ok">("loading");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [owners, setOwners] = useState<Profile[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [planCfgs, setPlanCfgs] = useState<PlanConfig[]>([]);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [planMsg, setPlanMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/acceso"; return; }
      const { data: me } = await supabase
        .from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
      if (me?.role !== "super_admin") { setStatus("denied"); return; }

      const [{ data: g }, { data: s }, { data: p }, { data: mem }] = await Promise.all([
        supabase.from("gyms").select("id, name, slug, owner_id, created_at, whatsapp"),
        supabase.from("subscriptions").select("gym_id, plan, status, trial_ends_at, current_period_end"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("members").select("gym_id"),
      ]);
      setGyms((g as Gym[]) || []);
      setSubs((s as Sub[]) || []);
      setOwners((p as Profile[]) || []);
      const c: Record<string, number> = {};
      ((mem as { gym_id: string }[]) || []).forEach((m) => { c[m.gym_id] = (c[m.gym_id] || 0) + 1; });
      setCounts(c);
      setPlanCfgs(await loadPlans(supabase));
      setStatus("ok");
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

  const subByGym = useMemo(() => {
    const m: Record<string, Sub> = {};
    subs.forEach((s) => (m[s.gym_id] = s));
    return m;
  }, [subs]);
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.full_name || "—";

  const metrics = useMemo(() => {
    const priceOf = (k: string) => planCfgs.find((p) => p.key === k)?.price ?? (PLAN_PRICES[k] || 0);
    let active = 0, trial = 0, mrr = 0;
    subs.forEach((s) => {
      if (s.status === "active") { active++; mrr += priceOf(s.plan); }
      else if (s.status === "trial") trial++;
    });
    return { total: gyms.length, active, trial, mrr };
  }, [subs, gyms, planCfgs]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/acceso";
  }

  // Alta/edición de la suscripción de un gimnasio (vos administrás esto acá).
  async function saveSub(gymId: string, patch: Partial<Sub>) {
    setSavingId(gymId);
    const current = subByGym[gymId];
    const row = {
      gym_id: gymId,
      plan: patch.plan ?? current?.plan ?? "basico",
      status: patch.status ?? current?.status ?? "trial",
      trial_ends_at: patch.trial_ends_at !== undefined ? patch.trial_ends_at : current?.trial_ends_at ?? null,
      current_period_end: patch.current_period_end !== undefined ? patch.current_period_end : current?.current_period_end ?? null,
    };
    const { error } = await supabase.from("subscriptions").upsert(row, { onConflict: "gym_id" });
    if (!error) {
      setSubs((ss) => {
        const rest = ss.filter((s) => s.gym_id !== gymId);
        return [...rest, row as Sub];
      });
    }
    setSavingId(null);
  }

  if (status === "loading") return <main className="grid min-h-screen place-items-center text-ink-2">Cargando…</main>;
  if (status === "denied") return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-ink-2">Esta sección es solo para el administrador de turnogym.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-brand hover:underline">Ir a mi panel →</Link>
      </div>
    </main>
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BrandMark size={32} className="rounded-lg" />
            <h1 className="text-2xl font-bold">turnogym · Super-Admin</h1>
          </div>
          <p className="mt-1 text-ink-2">Todos los gimnasios clientes y su suscripción.</p>
        </div>
        <button className="btn btn-ghost" onClick={logout}>Cerrar sesión</button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Gimnasios" value={String(metrics.total)} sub="en total" tone="text-brand" />
        <Stat label="Activos" value={String(metrics.active)} sub="pagando" tone="text-good" />
        <Stat label="En trial" value={String(metrics.trial)} sub="por convertir" tone="text-indigo" />
        <Stat label="MRR estimado" value={money(metrics.mrr)} sub="ingreso mensual" tone="text-brand" />
      </div>

      <div className="mt-6 card p-0">
        <div className="border-b border-white/10 p-4 text-sm font-semibold">Gimnasios</div>
        {gyms.length === 0 ? (
          <p className="p-8 text-center text-ink-2">Todavía no hay gimnasios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 pb-3 pt-1">Gimnasio</th>
                  <th className="px-4 pb-3 pt-1">Dueño</th>
                  <th className="px-4 pb-3 pt-1">Plan</th>
                  <th className="px-4 pb-3 pt-1">Estado</th>
                  <th className="px-4 pb-3 pt-1">Vence</th>
                  <th className="px-4 pb-3 pt-1 text-right">Socios</th>
                  <th className="px-4 pb-3 pt-1 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gyms.map((g) => {
                  const s = subByGym[g.id];
                  const st = s ? STATUS[s.status] : null;
                  const vence = s ? (s.status === "trial" ? s.trial_ends_at : s.current_period_end) : null;
                  return (
                    <tr key={g.id} className="border-t border-white/10 hover:bg-white/[.02]">
                      <td className="px-4 py-3">
                        <div className="font-medium">{g.name}</div>
                        <div className="text-xs text-muted">/{g.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{ownerName(g.owner_id)}</td>
                      <td className="px-4 py-3">
                        <select
                          className="input h-8 min-w-[104px] py-0 pr-7 text-xs"
                          value={s?.plan ?? "basico"}
                          onChange={(e) => saveSub(g.id, { plan: e.target.value as Sub["plan"] })}
                        >
                          {Object.keys(PLAN_LABEL).map((k) => <option key={k} value={k}>{PLAN_LABEL[k]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            className="input h-8 min-w-[120px] py-0 pr-7 text-xs"
                            value={s?.status ?? "trial"}
                            onChange={(e) => saveSub(g.id, { status: e.target.value as Sub["status"] })}
                          >
                            {Object.keys(STATUS).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                          </select>
                          {st && <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          className="input h-8 min-w-[150px] py-0 text-xs"
                          value={(vence || "").slice(0, 10)}
                          onChange={(e) =>
                            saveSub(g.id, s?.status === "trial"
                              ? { trial_ends_at: e.target.value || null }
                              : { current_period_end: e.target.value || null })
                          }
                        />
                        {savingId === g.id && <span className="ml-1 text-[11px] text-muted">Guardando…</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-2">{counts[g.id] || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          {(() => {
                            const link = waLink(g, s, (ownerName(g.owner_id).split(" ")[0] || ""));
                            return link ? (
                              <a
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-[#25D366]/40 px-2.5 py-1 text-xs font-semibold text-[#25D366] hover:bg-[rgba(37,211,102,.12)]"
                                title="Enviar un aviso por WhatsApp al dueño"
                              >
                                <span aria-hidden>💬</span> Avisar
                              </a>
                            ) : (
                              <span className="text-xs text-muted" title="Este gimnasio no tiene WhatsApp cargado">Sin WhatsApp</span>
                            );
                          })()}
                          <a href={`/${g.slug}`} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">Ver página</a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor de planes de turnogym */}
      <div className="mt-6 card">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Planes de turnogym</h2>
          {planMsg && <span className="text-sm text-brand">{planMsg}</span>}
        </div>
        <p className="mb-4 text-sm text-ink-2">
          Editá precio, textos, beneficios y qué funciones desbloquea cada plan. Los cambios se aplican en todo el
          sistema (Mi Plan de cada dueño y los candados de las funciones).
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
        </p>
      </div>

      {/* Cobros del SaaS */}
      <div className="mt-6 card">
        <h2 className="font-semibold">Cobros del abono (Mercado Pago)</h2>
        <p className="mt-1 text-sm text-ink-2">
          La integración con Mercado Pago ya está hecha: el dueño cambia su plan desde "Mi Plan", paga con débito
          automático y el estado se actualiza solo. Solo falta cargar <b>MP_ACCESS_TOKEN</b> en Vercel para activarlo.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-brand/30 bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <b>Mercado Pago</b>
              <span className="rounded-full bg-[rgba(34,211,238,.14)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-brand">Integrado</span>
            </div>
            <p className="mt-1 text-xs text-ink-2">Suscripción con débito automático mensual (ARS). Cargá tu token en Vercel para prenderlo.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <b>Stripe</b>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink-2">Sin conectar</span>
            </div>
            <p className="mt-1 text-xs text-ink-2">Para cobros internacionales en tarjeta.</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Precios configurados: {planCfgs.map((p) => `${p.label} ${money(p.price)}`).join(" · ")} por mes.
        </p>
      </div>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 text-xs text-ink-2">{sub}</div>
    </div>
  );
}
