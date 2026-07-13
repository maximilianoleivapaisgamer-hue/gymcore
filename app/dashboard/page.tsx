"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface Member {
  id: string;
  full_name: string;
  whatsapp: string | null;
  plan_name: string | null;
  plan_price: number | null;
  membership_expiry: string | null;
  created_at: string | null;
}
interface CashRow { date: string; type: "income" | "expense"; amount: number; }

function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return Math.ceil((new Date(expiry + "T00:00:00").getTime() - Date.now()) / 86400000);
}
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const moneyShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2).replace(".", ",") + "M";
  if (Math.abs(n) >= 1_000) return "$" + (n / 1_000).toFixed(1).replace(".", ",") + "k";
  return "$" + Math.round(n).toLocaleString("es-AR");
};
const MESES_C = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const AV_GRADS = [
  "from-[#7c3aed] to-[#a855f7]", "from-[#0891b2] to-[#06b6d4]",
  "from-[#ca8a04] to-[#eab308]", "from-[#059669] to-[#10b981]",
  "from-[#db2777] to-[#f472b6]", "from-[#4f46e5] to-[#818cf8]",
];

function KIcon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0111 0" /></>,
    dollar: <path d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="M20 6L9 17l-5-5" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]">{p[name]}</svg>;
}
function WhatsAppLogo({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="#25D366" aria-hidden="true">
      <path d="M16.003 3C9.38 3 4 8.38 4 15c0 2.114.553 4.174 1.6 5.99L4 29l8.2-1.55A11.94 11.94 0 0 0 16 27c6.62 0 12-5.38 12-12S22.62 3 16.003 3Zm0 21.86c-1.75 0-3.47-.47-4.97-1.36l-.36-.21-4.87.92.93-4.75-.23-.37a9.86 9.86 0 0 1-1.52-5.24c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c0 5.46-4.44 9.9-9.9 9.9Zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

export default function DashboardHome() {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [cash, setCash] = useState<CashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [gymName, setGymName] = useState("");
  const [canSeeIncome, setCanSeeIncome] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles").select("full_name, role, gym_id").eq("id", user.id)
        .single<{ full_name: string | null; role: string; gym_id: string | null }>();
      setName((profile?.full_name || "").split(" ")[0] || "");
      if (profile?.gym_id) {
        const { data: g } = await supabase.from("gyms").select("name, employees_see_income_card")
          .eq("id", profile.gym_id).maybeSingle<{ name: string; employees_see_income_card: boolean }>();
        setGymName(g?.name || "");
        if (profile.role === "empleado") setCanSeeIncome(!!g?.employees_see_income_card);
      }
      const now = new Date();
      const start6 = iso(new Date(now.getFullYear(), now.getMonth() - 5, 1));
      const [{ data: mem }, { data: cf }] = await Promise.all([
        supabase.from("members").select("id, full_name, whatsapp, plan_name, plan_price, membership_expiry, created_at"),
        supabase.from("cashflow_entries").select("date, type, amount").gte("date", start6),
      ]);
      setMembers((mem as Member[]) || []);
      setCash((cf as CashRow[]) || []);
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    let activos = 0, vencidos = 0, prontos = 0, nuevos = 0;
    for (const m of members) {
      if ((m.created_at || "").slice(0, 7) === thisMonth) nuevos++;
      const d = daysLeft(m.membership_expiry);
      if (d === null) continue;
      if (d < 0) vencidos++;
      else { activos++; if (d <= 7) prontos++; }
    }
    return { total: members.length, activos, vencidos, prontos, nuevos };
  }, [members]);

  const chart = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; ing: number; gas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: MESES_C[d.getMonth()], ing: 0, gas: 0 });
    }
    for (const c of cash) {
      const k = c.date.slice(0, 7);
      const b = buckets.find((x) => x.key === k);
      if (!b) continue;
      if (c.type === "income") b.ing += Number(c.amount); else b.gas += Number(c.amount);
    }
    const max = Math.max(1, ...buckets.flatMap((b) => [b.ing, b.gas]));
    return { buckets, max };
  }, [cash]);

  const ingresos = useMemo(() => {
    const now = new Date();
    const cur = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prev = `${prevD.getFullYear()}-${pad(prevD.getMonth() + 1)}`;
    let curSum = 0, prevSum = 0;
    for (const c of cash) {
      if (c.type !== "income") continue;
      const k = c.date.slice(0, 7);
      if (k === cur) curSum += Number(c.amount);
      else if (k === prev) prevSum += Number(c.amount);
    }
    const delta = prevSum > 0 ? Math.round(((curSum - prevSum) / prevSum) * 1000) / 10 : null;
    return { cur: curSum, delta };
  }, [cash]);

  const proximos = useMemo(() => {
    return [...members]
      .filter((m) => m.membership_expiry)
      .map((m) => ({ ...m, d: daysLeft(m.membership_expiry)! }))
      .sort((a, b) => a.d - b.d)
      .filter((m) => m.d <= 14)
      .slice(0, 6);
  }, [members]);

  const dash = loading ? "…" : "";

  return (
    <main className="p-5 md:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-[-.5px]">Hola{name ? `, ${name}` : ""} 👋</h1>
          <p className="mt-1 text-ink-2">
            Esto es lo que pasa hoy{gymName ? <> en <b className="text-ink">{gymName}</b></> : ""}.
          </p>
        </div>
        <Link href="/dashboard/socios" className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-br from-brand to-brand-2 px-4 py-2.5 text-[13.5px] font-semibold text-[#04121a] shadow-[0_8px_20px_rgba(34,211,238,.28)] transition hover:brightness-105">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>
          Agregar socio
        </Link>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Socios activos" icon="users" tone="text-brand" value={dash || String(stats.activos)}
          sub={<span className="text-good">▲ +{stats.nuevos} este mes</span>} />
        <Kpi label="Ingresos del mes" icon="dollar" tone="text-good"
          value={dash || (canSeeIncome ? moneyShort(ingresos.cur) : "🔒")}
          sub={canSeeIncome
            ? (ingresos.delta === null ? <span className="text-ink-2">este mes</span>
              : <span className={ingresos.delta >= 0 ? "text-good" : "text-crit"}>{ingresos.delta >= 0 ? "▲" : "▼"} {Math.abs(ingresos.delta)}% vs mes pasado</span>)
            : <span className="text-muted">oculto por el dueño</span>} />
        <Kpi label="Vencen esta semana" icon="clock" tone="text-warn" value={dash || String(stats.prontos)}
          sub={<span className="text-warn">Requieren seguimiento</span>} />
        <Kpi label="Asistencias hoy" icon="check" tone="text-indigo" value={dash || "—"}
          sub={<span className="text-muted">Se activa con Control de acceso</span>} />
      </div>

      {/* Chart + próximos */}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="text-base font-semibold">Ingresos vs Gastos</h3>
            <span className="text-[13px] font-semibold text-brand">Últimos 6 meses</span>
          </div>
          {!canSeeIncome ? (
            <div className="grid h-[200px] place-items-center text-sm text-muted">🔒 Ocultado por el dueño</div>
          ) : (
            <>
              <div className="flex h-[200px] items-end gap-4 pt-2.5">
                {chart.buckets.map((b) => (
                  <div key={b.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex h-full w-full items-end justify-center gap-[5px]">
                      <div className="w-4 rounded-t bg-gradient-to-b from-brand to-[#1596b0]" style={{ height: `${(b.ing / chart.max) * 100}%` }} title={money(b.ing)} />
                      <div className="w-4 rounded-t bg-gradient-to-b from-[#3b4b63] to-[#2a3547]" style={{ height: `${(b.gas / chart.max) * 100}%` }} title={money(b.gas)} />
                    </div>
                    <span className="text-[11.5px] text-muted">{b.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-[18px]">
                <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2"><i className="block h-2.5 w-2.5 rounded-[3px] bg-brand" />Ingresos</div>
                <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2"><i className="block h-2.5 w-2.5 rounded-[3px] bg-[#3b4b63]" />Gastos</div>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="text-base font-semibold">Próximos a vencer</h3>
            <Link href="/dashboard/socios" className="text-[13px] font-semibold text-brand hover:underline">Ver todos</Link>
          </div>
          {loading ? (
            <p className="py-8 text-center text-ink-2">Cargando…</p>
          ) : proximos.length === 0 ? (
            <p className="py-8 text-center text-ink-2">No hay vencimientos próximos.</p>
          ) : (
            proximos.map((m, i) => {
              const cls = m.d < 0 ? "crit" : "warn";
              const txt = m.d < 0 ? "Vencido" : m.d === 0 ? "Hoy" : `${m.d} días`;
              const waMsg = `Hola ${m.full_name.split(" ")[0]}! Te recordamos que tu cuota${m.plan_name ? ` del plan ${m.plan_name}` : ""} ${m.d < 0 ? `venció hace ${Math.abs(m.d)} día(s)` : m.d === 0 ? "vence hoy" : `vence en ${m.d} día(s)`}. ¡Gracias!`;
              const waLink = m.whatsapp ? `https://wa.me/${m.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(waMsg)}` : null;
              return (
                <div key={m.id} className="flex items-center justify-between border-t border-white/[.08] py-3 first:border-0">
                  <div className="flex min-w-0 items-center gap-[11px]">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br ${AV_GRADS[i % AV_GRADS.length]} text-xs font-bold`}>
                      {m.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.full_name}</div>
                      <div className="truncate text-xs text-muted">{m.plan_name || "Sin plan"}{m.plan_price ? ` · ${money(m.plan_price)}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${cls === "crit" ? "bg-[rgba(240,82,82,.14)] text-[#f87171]" : "bg-[rgba(245,177,61,.14)] text-[#f5b13d]"}`}>
                      <i className="h-1.5 w-1.5 rounded-full bg-current" />{txt}
                    </span>
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noreferrer" title="Recordatorio por WhatsApp"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-white/[.08] bg-surface-2 transition hover:border-[#25d366]/40">
                        <WhatsAppLogo className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Acciones rápidas */}
      <h3 className="mb-3.5 text-base font-semibold">Acciones rápidas</h3>
      <div className="flex flex-wrap gap-3">
        <Quick href="/dashboard/socios" title="Agregar socio" sub="Alta con onboarding WhatsApp"
          icon={<path d="M12 5v14M5 12h14" />} />
        <Quick href="/dashboard/rutinas" title="Cargar rutina" sub="Constructor por socio"
          icon={<path d="M6.5 6.5v11M17.5 6.5v11M6.5 12h11" />} />
        <Quick href="/dashboard/finanzas" title="Registrar movimiento" sub="Ingreso o gasto"
          icon={<path d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />} />
        <Quick href="/dashboard/clases" title="Nueva clase" sub="Con cupos y reservas"
          icon={<><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18" /></>} />
      </div>
    </main>
  );
}

function Kpi({ label, icon, tone, value, sub }: { label: string; icon: string; tone: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between text-[12.5px] font-medium text-ink-2">
        {label}
        <span className={`grid h-9 w-9 place-items-center rounded-[10px] bg-surface-3 ${tone}`}><KIcon name={icon} /></span>
      </div>
      <div className="mt-3.5 text-[30px] font-bold tracking-[-1px] tabular-nums">{value}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px]">{sub}</div>
    </div>
  );
}

function Quick({ href, title, sub, icon }: { href: string; title: string; sub: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-w-[160px] flex-1 items-center gap-3 rounded-[14px] border border-white/[.08] bg-surface p-4 transition hover:border-brand/35">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-surface-3 text-brand">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </div>
      <div>
        <b className="text-sm">{title}</b>
        <p className="text-xs text-muted">{sub}</p>
      </div>
    </Link>
  );
}
