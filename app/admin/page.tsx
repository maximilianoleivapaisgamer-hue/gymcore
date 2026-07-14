"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface Gym { id: string; name: string; slug: string; owner_id: string; created_at: string; }
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

export default function AdminPage() {
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "denied" | "ok">("loading");
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [owners, setOwners] = useState<Profile[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/acceso"; return; }
      const { data: me } = await supabase
        .from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
      if (me?.role !== "super_admin") { setStatus("denied"); return; }

      const [{ data: g }, { data: s }, { data: p }, { data: mem }] = await Promise.all([
        supabase.from("gyms").select("id, name, slug, owner_id, created_at"),
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
      setStatus("ok");
    })();
    /* eslint-disable-next-line */
  }, []);

  const subByGym = useMemo(() => {
    const m: Record<string, Sub> = {};
    subs.forEach((s) => (m[s.gym_id] = s));
    return m;
  }, [subs]);
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.full_name || "—";

  const metrics = useMemo(() => {
    let active = 0, trial = 0, mrr = 0;
    subs.forEach((s) => {
      if (s.status === "active") { active++; mrr += PLAN_PRICES[s.plan] || 0; }
      else if (s.status === "trial") trial++;
    });
    return { total: gyms.length, active, trial, mrr };
  }, [subs, gyms]);

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
        <p className="mt-2 text-ink-2">Esta sección es solo para el administrador de GymCore.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-brand hover:underline">Ir a mi panel →</Link>
      </div>
    </main>
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-sm font-black text-black">G</div>
            <h1 className="text-2xl font-bold">GymCore · Super-Admin</h1>
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
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 pb-3 pt-1">Gimnasio</th>
                  <th className="px-4 pb-3 pt-1">Dueño</th>
                  <th className="px-4 pb-3 pt-1">Plan</th>
                  <th className="px-4 pb-3 pt-1">Estado</th>
                  <th className="px-4 pb-3 pt-1">Vence</th>
                  <th className="px-4 pb-3 pt-1 text-right">Socios</th>
                  <th className="px-4 pb-3 pt-1"></th>
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
                          className="input h-8 py-0 text-xs"
                          value={s?.plan ?? "basico"}
                          onChange={(e) => saveSub(g.id, { plan: e.target.value as Sub["plan"] })}
                        >
                          {Object.keys(PLAN_LABEL).map((k) => <option key={k} value={k}>{PLAN_LABEL[k]}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input h-8 py-0 text-xs"
                          value={s?.status ?? "trial"}
                          onChange={(e) => saveSub(g.id, { status: e.target.value as Sub["status"] })}
                        >
                          {Object.keys(STATUS).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                        </select>
                        {st && <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          className="input h-8 py-0 text-xs"
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
                      <td className="px-4 py-3 text-right">
                        <a href={`/${g.slug}`} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">Ver página</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cobros del SaaS */}
      <div className="mt-6 card">
        <h2 className="font-semibold">Cobros del abono (Stripe / Mercado Pago)</h2>
        <p className="mt-1 text-sm text-ink-2">
          El estado de cada suscripción (activo, impago, cancelado) se actualiza automáticamente cuando conectás
          una pasarela de pago. La integración está lista para enchufar: falta cargar tus claves de API.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <b>Mercado Pago</b>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink-2">Sin conectar</span>
            </div>
            <p className="mt-1 text-xs text-ink-2">Recomendado para Argentina (cobro en pesos, débito automático).</p>
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
          Precios configurados: Básico {money(PLAN_PRICES.basico)} · Pro {money(PLAN_PRICES.pro)} · Elite {money(PLAN_PRICES.elite)} por mes.
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
