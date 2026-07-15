"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { loadPlans, type PlanConfig } from "@/lib/plans";
import {
  PLAN_LABEL, PLAN_PRICES, STATUS, METHOD_LABEL,
  money, fdate, venceOf, daysUntil, isProximoVence, isVencido,
} from "@/lib/admin";

interface Gym { id: string; name: string; slug: string; owner_id: string; created_at: string; whatsapp: string | null; }
interface Sub {
  gym_id: string;
  plan: "basico" | "pro" | "elite";
  status: "trial" | "active" | "past_due" | "canceled";
  trial_ends_at: string | null;
  current_period_end: string | null;
  payment_method: string | null;
}
interface Profile { id: string; full_name: string | null; }

/** Aviso por WhatsApp con un mensaje según el estado del gimnasio. */
function waLink(gym: Gym, sub: Sub | undefined, ownerFirst: string): string | null {
  const phone = (gym.whatsapp || "").replace(/\D/g, "");
  if (!phone) return null;
  const hola = ownerFirst ? `¡Hola ${ownerFirst}!` : "¡Hola!";
  const plan = sub ? PLAN_LABEL[sub.plan] : "";
  const vence = fdate(venceOf(sub));
  let msg: string;
  if (sub?.status === "trial") {
    msg = `${hola} Te escribo de turnogym 👋 Tu prueba gratis vence el ${vence}. Si querés seguir, activamos tu plan ${plan} y listo. ¿Lo dejamos andando?`;
  } else if (sub?.status === "past_due") {
    msg = `${hola} Te escribo de turnogym. Nos figura un pago pendiente de tu plan ${plan}. ¿Coordinamos para regularizarlo y que no se te corte el servicio?`;
  } else if (sub?.status === "canceled") {
    msg = `${hola} Te escribo de turnogym. Vimos que tu plan quedó dado de baja; si querés reactivarlo, te lo dejo andando en un toque.`;
  } else if (isProximoVence(sub)) {
    msg = `${hola} Te escribo de turnogym. Tu abono ${plan} vence el ${vence}. ¿Coordinamos la renovación así no se te corta?`;
  } else {
    msg = `${hola} Te escribo de turnogym para ver cómo venís con el sistema. ¿Necesitás una mano con algo?`;
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export default function AdminDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [owners, setOwners] = useState<Profile[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [planCfgs, setPlanCfgs] = useState<PlanConfig[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: g }, { data: s }, { data: p }, { data: mem }] = await Promise.all([
        supabase.from("gyms").select("id, name, slug, owner_id, created_at, whatsapp").eq("is_demo", false),
        supabase.from("subscriptions").select("gym_id, plan, status, trial_ends_at, current_period_end, payment_method"),
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
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  const subByGym = useMemo(() => {
    const m: Record<string, Sub> = {};
    subs.forEach((s) => (m[s.gym_id] = s));
    return m;
  }, [subs]);
  const gymById = useMemo(() => {
    const m: Record<string, Gym> = {};
    gyms.forEach((g) => (m[g.id] = g));
    return m;
  }, [gyms]);
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.full_name || "—";
  const priceOf = (k: string) => planCfgs.find((p) => p.key === k)?.price ?? (PLAN_PRICES[k] || 0);

  const metrics = useMemo(() => {
    let active = 0, trial = 0, mrr = 0, transfer = 0, mp = 0, transferN = 0, mpN = 0, porVencer = 0;
    subs.forEach((s) => {
      // Solo gimnasios reales (no demos): filtramos por los que están en la lista.
      if (!gymById[s.gym_id]) return;
      if (s.status === "active") {
        active++;
        const amt = priceOf(s.plan);
        mrr += amt;
        if (s.payment_method === "mercadopago") { mp += amt; mpN++; }
        else { transfer += amt; transferN++; } // por defecto (transferencia o sin registrar)
      } else if (s.status === "trial") trial++;
      if (isProximoVence(s) || isVencido(s)) porVencer++;
    });
    return { total: gyms.length, active, trial, mrr, transfer, mp, transferN, mpN, porVencer };
    /* eslint-disable-next-line */
  }, [subs, gyms, planCfgs, gymById]);

  // Gimnasios cuyo abono está por vencer o ya venció (para el bloque de alertas).
  const vencimientos = useMemo(() => {
    const rows: { g: Gym; s: Sub | undefined }[] = gyms.map((g) => ({ g, s: subByGym[g.id] }));
    return rows
      .filter(({ s }) => isProximoVence(s) || isVencido(s))
      .sort((a, b) => (daysUntil(venceOf(a.s)) ?? 999) - (daysUntil(venceOf(b.s)) ?? 999));
  }, [gyms, subByGym]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return gyms;
    return gyms.filter((g) =>
      g.name.toLowerCase().includes(t) || g.slug.toLowerCase().includes(t) || ownerName(g.owner_id).toLowerCase().includes(t));
    /* eslint-disable-next-line */
  }, [gyms, q, owners]);

  async function saveSub(gymId: string, patch: Partial<Sub>) {
    setSavingId(gymId);
    const current = subByGym[gymId];
    const nextStatus = patch.status ?? current?.status ?? "trial";
    const row: Sub = {
      gym_id: gymId,
      plan: patch.plan ?? current?.plan ?? "basico",
      status: nextStatus,
      trial_ends_at: patch.trial_ends_at !== undefined ? patch.trial_ends_at : current?.trial_ends_at ?? null,
      current_period_end: patch.current_period_end !== undefined ? patch.current_period_end : current?.current_period_end ?? null,
      payment_method:
        patch.payment_method !== undefined
          ? patch.payment_method
          : current?.payment_method ?? (nextStatus === "active" ? "transferencia" : null),
    };
    const { error } = await supabase.from("subscriptions").upsert(row, { onConflict: "gym_id" });
    if (!error) {
      setSubs((ss) => [...ss.filter((s) => s.gym_id !== gymId), row]);
    }
    setSavingId(null);
  }

  if (loading) return <div className="grid min-h-[50vh] place-items-center text-ink-2">Cargando…</div>;

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-ink-2">Todos los gimnasios clientes, su suscripción y cómo pagan.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Gimnasios" value={String(metrics.total)} sub="en total" tone="text-brand" />
        <Stat label="Activos" value={String(metrics.active)} sub="pagando" tone="text-good" />
        <Stat label="En trial" value={String(metrics.trial)} sub="por convertir" tone="text-indigo" />
        <Stat label="MRR estimado" value={money(metrics.mrr)} sub="ingreso mensual" tone="text-brand" />
      </div>

      {/* Split de cobros: transferencia vs Mercado Pago */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">🏦 Por transferencia</div>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-ink-2">{metrics.transferN} gim.</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-good">{money(metrics.transfer)}</div>
          <div className="text-xs text-ink-2">por mes · cargados a mano</div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">💳 Por Mercado Pago</div>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-ink-2">{metrics.mpN} gim.</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-brand">{money(metrics.mp)}</div>
          <div className="text-xs text-ink-2">por mes · débito automático</div>
        </div>
      </div>

      {/* Próximos a vencer / vencidos */}
      {vencimientos.length > 0 && (
        <div className="mt-4 card border-warn/30">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold">⏰ Abonos por vencer</span>
            <span className="rounded-full bg-[rgba(245,177,61,.14)] px-2 py-0.5 text-[11px] font-semibold text-warn">{vencimientos.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {vencimientos.map(({ g, s }: { g: Gym; s: Sub | undefined }) => {
              const d = daysUntil(venceOf(s));
              const vencido = isVencido(s);
              return (
                <div key={g.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${vencido ? "border-crit/30 bg-[rgba(240,82,82,.08)]" : "border-warn/30 bg-[rgba(245,177,61,.08)]"}`}>
                  <span className="font-semibold">{g.name}</span>
                  <span className={vencido ? "text-crit" : "text-warn"}>
                    {vencido ? `venció hace ${Math.abs(d ?? 0)}d` : d === 0 ? "vence hoy" : `vence en ${d}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabla de gimnasios (a todo el ancho) */}
      <div className="mt-6 card p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
          <span className="text-sm font-semibold">Gimnasios</span>
          <input
            className="input h-9 w-full py-0 text-sm sm:w-64"
            placeholder="Buscar gimnasio o dueño…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-ink-2">{gyms.length === 0 ? "Todavía no hay gimnasios registrados." : "Sin resultados."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 pb-3 pt-3">Gimnasio</th>
                  <th className="px-4 pb-3 pt-3">Dueño</th>
                  <th className="px-4 pb-3 pt-3">Plan</th>
                  <th className="px-4 pb-3 pt-3">Estado</th>
                  <th className="px-4 pb-3 pt-3">Método</th>
                  <th className="px-4 pb-3 pt-3">Vence</th>
                  <th className="px-4 pb-3 pt-3 text-right">Socios</th>
                  <th className="px-4 pb-3 pt-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const s = subByGym[g.id];
                  const st = s ? STATUS[s.status] : null;
                  const vence = venceOf(s);
                  const porVencer = isProximoVence(s);
                  const vencido = isVencido(s);
                  return (
                    <tr key={g.id} className="border-t border-white/10 align-middle hover:bg-white/[.02]">
                      <td className="px-4 py-3">
                        <div className="font-medium">{g.name}</div>
                        <div className="text-xs text-muted">/{g.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{ownerName(g.owner_id)}</td>
                      <td className="px-4 py-3">
                        <select
                          className="input h-8 w-[100px] py-0 pr-7 text-xs"
                          value={s?.plan ?? "basico"}
                          onChange={(e) => saveSub(g.id, { plan: e.target.value as Sub["plan"] })}
                        >
                          {Object.keys(PLAN_LABEL).map((k) => <option key={k} value={k}>{PLAN_LABEL[k]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <select
                            className="input h-8 w-[124px] py-0 pr-7 text-xs"
                            value={s?.status ?? "trial"}
                            onChange={(e) => saveSub(g.id, { status: e.target.value as Sub["status"] })}
                          >
                            {Object.keys(STATUS).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                          </select>
                          {(porVencer || vencido) && (
                            <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${vencido ? "bg-[rgba(240,82,82,.14)] text-crit" : "bg-[rgba(245,177,61,.14)] text-warn"}`}>
                              {vencido ? "Vencido" : "Próximo a vencer"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input h-8 w-[128px] py-0 pr-7 text-xs"
                          value={s?.payment_method ?? ""}
                          onChange={(e) => saveSub(g.id, { payment_method: e.target.value || null })}
                        >
                          <option value="">— Sin registrar</option>
                          {Object.keys(METHOD_LABEL).map((k) => <option key={k} value={k}>{METHOD_LABEL[k]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          className="input h-8 w-[140px] py-0 text-xs"
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
                              <a href={link} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-[#25D366]/40 px-2.5 py-1 text-xs font-semibold text-[#25D366] hover:bg-[rgba(37,211,102,.12)]"
                                title="Enviar un aviso por WhatsApp al dueño">
                                <span aria-hidden>💬</span> Avisar
                              </a>
                            ) : (
                              <span className="text-xs text-muted" title="Este gimnasio no tiene WhatsApp cargado">Sin WhatsApp</span>
                            );
                          })()}
                          <a href={`/${g.slug}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">Ver página</a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-white/10 px-4 py-3 text-[11px] text-muted">
          El método se marca solo en “Mercado Pago” cuando el dueño paga con débito automático. Los cobros que registrás a mano quedan como “Transferencia”.
        </p>
      </div>
    </div>
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
