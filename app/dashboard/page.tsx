"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface Member {
  id: string;
  full_name: string;
  plan_name: string | null;
  plan_price: number | null;
  membership_expiry: string | null;
}

function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  const d = new Date(expiry + "T00:00:00");
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

const money = (n: number) =>
  "$" + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

// Clases literales (Tailwind no genera clases construidas dinámicamente).
const STAT_TONE: Record<string, string> = {
  brand: "text-brand",
  good: "text-good",
  crit: "text-crit",
  indigo: "text-indigo",
};

export default function DashboardHome() {
  const supabase = createClient();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [canSeeIncome, setCanSeeIncome] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles").select("full_name, role, gym_id").eq("id", user.id)
        .single<{ full_name: string | null; role: string; gym_id: string | null }>();
      setName((profile?.full_name || "").split(" ")[0] || "");
      if (profile?.role === "empleado" && profile.gym_id) {
        const { data: g } = await supabase.from("gyms").select("employees_see_income_card")
          .eq("id", profile.gym_id).maybeSingle<{ employees_see_income_card: boolean }>();
        setCanSeeIncome(!!g?.employees_see_income_card);
      }
      const { data } = await supabase
        .from("members").select("id, full_name, plan_name, plan_price, membership_expiry");
      setMembers((data as Member[]) || []);
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  const stats = useMemo(() => {
    let activos = 0, vencidos = 0, prontos = 0, ingresos = 0;
    for (const m of members) {
      const d = daysLeft(m.membership_expiry);
      if (d === null) continue;
      if (d < 0) vencidos++;
      else {
        activos++;
        ingresos += Number(m.plan_price || 0);
        if (d <= 7) prontos++;
      }
    }
    return { total: members.length, activos, vencidos, prontos, ingresos };
  }, [members]);

  const proximos = useMemo(() => {
    return [...members]
      .filter((m) => m.membership_expiry)
      .map((m) => ({ ...m, d: daysLeft(m.membership_expiry)! }))
      .sort((a, b) => a.d - b.d)
      .filter((m) => m.d <= 14)
      .slice(0, 6);
  }, [members]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hola{name ? `, ${name}` : ""} 👋</h1>
        <p className="text-ink-2">Este es el resumen de tu gimnasio hoy.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Socios" value={loading ? "…" : String(stats.total)} sub="en total" tone="brand" />
        <Stat label="Activos" value={loading ? "…" : String(stats.activos)} sub={`${stats.prontos} vencen esta semana`} tone="good" />
        <Stat label="Vencidos" value={loading ? "…" : String(stats.vencidos)} sub="a reactivar" tone="crit" />
        <Stat label="Ingresos activos" value={loading ? "…" : canSeeIncome ? money(stats.ingresos) : "🔒"} sub={canSeeIncome ? "por mes (estimado)" : "oculto por el dueño"} tone="indigo" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h2 className="font-semibold">Próximos vencimientos</h2>
            <Link href="/dashboard/socios" className="text-sm text-brand hover:underline">Ver socios →</Link>
          </div>
          {loading ? (
            <p className="p-8 text-center text-ink-2">Cargando…</p>
          ) : proximos.length === 0 ? (
            <p className="p-8 text-center text-ink-2">
              No hay vencimientos próximos. {stats.total === 0 && "Cargá tu primer socio para ver datos acá."}
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {proximos.map((m) => {
                const cls = m.d < 0 ? "text-crit" : m.d <= 7 ? "text-warn" : "text-ink-2";
                const txt = m.d < 0 ? `Venció hace ${Math.abs(m.d)} d` : m.d === 0 ? "Vence hoy" : `Vence en ${m.d} d`;
                return (
                  <li key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-[11px] font-bold text-black">
                        {m.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{m.full_name}</div>
                        <div className="text-xs text-muted">{m.plan_name || "Sin plan"}</div>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${cls}`}>{txt}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Accesos rápidos</h2>
          <div className="flex flex-col gap-2">
            <Link href="/dashboard/socios" className="rounded-lg border border-white/10 bg-surface-2 px-4 py-3 text-sm transition hover:border-brand/40">
              <b>+ Agregar socio</b>
              <p className="text-xs text-ink-2">Cargá un nuevo miembro y su plan.</p>
            </Link>
            <Link href="/dashboard/configuracion" className="rounded-lg border border-white/10 bg-surface-2 px-4 py-3 text-sm transition hover:border-brand/40">
              <b>Configurar mi página</b>
              <p className="text-xs text-ink-2">Logo, colores, planes y textos.</p>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${STAT_TONE[tone]}`}>{value}</div>
      <div className="mt-1 text-xs text-ink-2">{sub}</div>
    </div>
  );
}
