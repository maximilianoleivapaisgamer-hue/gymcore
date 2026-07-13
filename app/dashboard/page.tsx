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
}

/** Logo oficial de WhatsApp (verde). */
function WhatsAppLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="#25D366" aria-hidden="true">
      <path d="M16.003 3C9.38 3 4 8.38 4 15c0 2.114.553 4.174 1.6 5.99L4 29l8.2-1.55A11.94 11.94 0 0 0 16 27c6.62 0 12-5.38 12-12S22.62 3 16.003 3Zm0 21.86c-1.75 0-3.47-.47-4.97-1.36l-.36-.21-4.87.92.93-4.75-.23-.37a9.86 9.86 0 0 1-1.52-5.24c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c0 5.46-4.44 9.9-9.9 9.9Zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
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
        .from("members").select("id, full_name, whatsapp, plan_name, plan_price, membership_expiry");
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
                const waMsg = m.d < 0
                  ? `Hola ${m.full_name.split(" ")[0]}! Te recordamos que tu cuota${m.plan_name ? ` del plan ${m.plan_name}` : ""} venció hace ${Math.abs(m.d)} día(s). Cuando puedas pasá a renovarla. ¡Gracias!`
                  : `Hola ${m.full_name.split(" ")[0]}! Te recordamos que tu cuota${m.plan_name ? ` del plan ${m.plan_name}` : ""} ${m.d === 0 ? "vence hoy" : `vence en ${m.d} día(s)`}. ¡Gracias!`;
                const waLink = m.whatsapp
                  ? `https://wa.me/${m.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(waMsg)}`
                  : null;
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
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${cls}`}>{txt}</span>
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noreferrer" title="Enviar recordatorio por WhatsApp"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-surface-2 transition hover:border-[#25D366]/50 hover:bg-[rgba(37,211,102,.1)]">
                          <WhatsAppLogo className="h-[18px] w-[18px]" />
                        </a>
                      )}
                    </div>
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
