"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { loadPlans, type PlanConfig } from "@/lib/plans";
import {
  PLAN_LABEL, PLAN_PRICES, STATUS, METHOD_LABEL,
  money, fdate, venceOf, daysUntil, isProximoVence, isVencido,
} from "@/lib/admin";

interface Gym { id: string; name: string; slug: string; owner_id: string; created_at: string; whatsapp: string | null; archived: boolean; }
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
  const [busyGym, setBusyGym] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const seedOffset = useRef(0);

  // Carga TODA la librería en tandas (traduce con IA). No se frena por una tanda:
  // si una falla la traducción, el servidor la degrada y sigue; y ante un corte
  // de red reintenta la misma tanda varias veces. Reanudable e idempotente.
  async function seedEjercicios() {
    setSeedBusy(true);
    let offset = seedOffset.current;
    let total = 0, done = false, guard = 0, netFails = 0;
    type Resp = { ok?: boolean; total?: number; nextOffset?: number; done?: boolean; error?: string };
    try {
      while (!done && guard < 900) {
        guard++;
        let r: Resp | null = null;
        try {
          r = await fetch("/api/admin/exercises/seed", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ offset, limit: 12 }),
          }).then((x) => x.json());
        } catch { r = null; }

        if (!r) { // corte de red: reintentamos la misma tanda
          netFails++;
          if (netFails > 6) {
            seedOffset.current = offset;
            setSeedMsg(`Se cortó la conexión en ${offset}${total ? `/${total}` : ""}. Tocá de nuevo para seguir.`);
            setSeedBusy(false); return;
          }
          setSeedMsg(`Reintentando en ${offset}${total ? `/${total}` : ""}…`);
          await new Promise((res) => setTimeout(res, 1500));
          continue;
        }
        if (!r.ok) {
          seedOffset.current = offset;
          setSeedMsg(`Se pausó en ${offset}. Tocá de nuevo para continuar. ${r.error ? `(${r.error})` : ""}`);
          setSeedBusy(false); return;
        }
        netFails = 0;
        total = r.total ?? total; offset = r.nextOffset ?? offset; done = !!r.done;
        seedOffset.current = done ? 0 : offset;
        setSeedMsg(`Cargando y traduciendo… ${Math.min(offset, total)} / ${total}`);
      }
      setSeedMsg(`✓ Librería lista: ${total} ejercicios. Si alguno quedó en inglés, tocá de nuevo y completa solo los que faltan.`);
    } catch {
      seedOffset.current = offset;
      setSeedMsg(`Se cortó en ${offset}${total ? `/${total}` : ""}. Tocá de nuevo para continuar desde ahí.`);
    }
    setSeedBusy(false);
  }

  const activeGyms = useMemo(() => gyms.filter((g) => !g.archived), [gyms]);
  const archivedGyms = useMemo(() => gyms.filter((g) => g.archived), [gyms]);

  async function gestionGym(gymId: string, action: "archivar" | "desarchivar" | "eliminar") {
    setBusyGym(gymId);
    const r = await fetch("/api/admin/gimnasios", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ gymId, action }),
    }).then((x) => x.json()).catch(() => null);
    setBusyGym(null);
    if (!r?.ok) { alert(r?.error || "No se pudo completar la acción."); return; }
    if (action === "eliminar") setGyms((gs) => gs.filter((g) => g.id !== gymId));
    else setGyms((gs) => gs.map((g) => (g.id === gymId ? { ...g, archived: action === "archivar" } : g)));
  }
  function archivar(g: Gym) {
    if (!confirm(`¿Archivar "${g.name}"? Sale de la lista de clientes y de las métricas, pero no se borra. Lo podés reactivar cuando quieras.`)) return;
    gestionGym(g.id, "archivar");
  }
  function eliminar(g: Gym) {
    if (!confirm(`¿ELIMINAR "${g.name}" para siempre? Se borran el gimnasio, sus socios, rutinas, caja y las cuentas de acceso. Esta acción NO se puede deshacer.`)) return;
    gestionGym(g.id, "eliminar");
  }

  useEffect(() => {
    (async () => {
      const [{ data: g }, { data: s }, { data: p }, { data: mem }] = await Promise.all([
        supabase.from("gyms").select("id, name, slug, owner_id, created_at, whatsapp, archived").eq("is_demo", false),
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
    activeGyms.forEach((g) => (m[g.id] = g));
    return m;
  }, [activeGyms]);
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
    return { total: activeGyms.length, active, trial, mrr, transfer, mp, transferN, mpN, porVencer };
    /* eslint-disable-next-line */
  }, [subs, activeGyms, planCfgs, gymById]);

  // Gimnasios cuyo abono está por vencer o ya venció (para el bloque de alertas).
  const vencimientos = useMemo(() => {
    const rows: { g: Gym; s: Sub | undefined }[] = activeGyms.map((g) => ({ g, s: subByGym[g.id] }));
    return rows
      .filter(({ s }) => isProximoVence(s) || isVencido(s))
      .sort((a, b) => (daysUntil(venceOf(a.s)) ?? 999) - (daysUntil(venceOf(b.s)) ?? 999));
  }, [activeGyms, subByGym]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return activeGyms;
    return activeGyms.filter((g) =>
      g.name.toLowerCase().includes(t) || g.slug.toLowerCase().includes(t) || ownerName(g.owner_id).toLowerCase().includes(t));
    /* eslint-disable-next-line */
  }, [activeGyms, q, owners]);

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
    <div className="w-full">
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
          <p className="p-8 text-center text-ink-2">{activeGyms.length === 0 ? "Todavía no hay gimnasios registrados." : "Sin resultados."}</p>
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
                          className="sel w-[120px] text-xs"
                          value={s?.plan ?? "basico"}
                          onChange={(e) => saveSub(g.id, { plan: e.target.value as Sub["plan"] })}
                        >
                          {Object.keys(PLAN_LABEL).map((k) => <option key={k} value={k}>{PLAN_LABEL[k]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <select
                            className="sel w-[132px] text-xs"
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
                          className="sel w-[150px] text-xs"
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
                          className="input w-[150px] py-2 text-xs"
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
                          <button onClick={() => archivar(g)} disabled={busyGym === g.id} className="text-ink-2 hover:text-warn disabled:opacity-50" title="Sacar de clientes sin borrar (reversible)">Archivar</button>
                          <button onClick={() => eliminar(g)} disabled={busyGym === g.id} className="text-ink-2 hover:text-crit disabled:opacity-50" title="Borrar para siempre">Eliminar</button>
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

      {/* Librería de ejercicios */}
      <div className="mt-6 card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">💪 Librería de ejercicios</h2>
            <p className="mt-1 text-sm text-ink-2">
              Ejercicios con demostración animada (foto inicio/fin) e instrucciones en español, compartidos con todos los
              gimnasios. Aparecen al armar rutinas y el socio los ve en “cómo se hace”.
            </p>
          </div>
          <button className="btn btn-primary shrink-0" disabled={seedBusy} onClick={seedEjercicios}>
            {seedBusy ? "Cargando…" : "Cargar / actualizar librería (800+)"}
          </button>
        </div>
        {seedMsg && <p className="mt-3 text-sm text-brand">{seedMsg}</p>}
        <p className="mt-2 text-[11px] text-muted">
          Baja la base pública (dominio público) y carga TODOS los ejercicios con foto, traduciendo nombres e
          instrucciones al español con IA (usa tu ANTHROPIC_API_KEY). Tarda unos minutos y va mostrando el progreso;
          es reanudable e idempotente (no duplica). No cierres esta pestaña mientras corre.
        </p>
      </div>

      {/* Archivados */}
      {archivedGyms.length > 0 && (
        <div className="mt-6 card p-0">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center justify-between gap-2 p-4 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              🗄️ Archivados
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-ink-2">{archivedGyms.length}</span>
            </span>
            <span className="text-xs text-brand">{showArchived ? "Ocultar" : "Ver"}</span>
          </button>
          {showArchived && (
            <div className="overflow-x-auto border-t border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 pb-3 pt-3">Gimnasio</th>
                    <th className="px-4 pb-3 pt-3">Dueño</th>
                    <th className="px-4 pb-3 pt-3 text-right">Socios</th>
                    <th className="px-4 pb-3 pt-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedGyms.map((g) => (
                    <tr key={g.id} className="border-t border-white/10 hover:bg-white/[.02]">
                      <td className="px-4 py-3">
                        <div className="font-medium">{g.name}</div>
                        <div className="text-xs text-muted">/{g.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{ownerName(g.owner_id)}</td>
                      <td className="px-4 py-3 text-right text-ink-2">{counts[g.id] || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3 text-xs font-semibold">
                          <a href={`/${g.slug}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">Ver página</a>
                          <button onClick={() => gestionGym(g.id, "desarchivar")} disabled={busyGym === g.id} className="text-good hover:underline disabled:opacity-50">Reactivar</button>
                          <button onClick={() => eliminar(g)} disabled={busyGym === g.id} className="text-ink-2 hover:text-crit disabled:opacity-50">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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
