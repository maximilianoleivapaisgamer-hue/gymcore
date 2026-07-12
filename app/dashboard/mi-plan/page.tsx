"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { SUB_PLANS, SUB_STATUS_LABEL, type SubPlanKey } from "@/types/db";

interface Sub {
  plan: SubPlanKey;
  status: "trial" | "active" | "past_due" | "canceled";
  trial_ends_at: string | null;
  current_period_end: string | null;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const fdate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-AR") : "—");

/**
 * "Mi plan": el abono mensual del DUEÑO con GymCore (no confundir con los
 * planes de sus socios). El plan y estado los configura Maxi desde /admin;
 * acá el dueño solo ve en qué situación está.
 */
export default function MiPlanPage() {
  const supabase = createClient();
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
      if (profile?.gym_id) {
        const { data } = await supabase
          .from("subscriptions").select("plan, status, trial_ends_at, current_period_end")
          .eq("gym_id", profile.gym_id).single<Sub>();
        setSub(data ?? null);
      }
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  const st = sub ? SUB_STATUS_LABEL[sub.status] : null;
  const vence = sub ? (sub.status === "trial" ? sub.trial_ends_at : sub.current_period_end) : null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
          <Link href="/dashboard" className="hover:text-brand">Panel</Link>
          <span>/</span><span>Mi plan</span>
        </div>
        <h1 className="text-2xl font-bold">Mi plan</h1>
        <p className="text-ink-2">Tu abono mensual con GymCore.</p>
      </div>

      {loading ? (
        <p className="p-8 text-center text-ink-2">Cargando…</p>
      ) : (
        <>
          <div className="card mb-6">
            {sub ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted">Estado de tu cuenta</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {SUB_PLANS.find((p) => p.key === sub.plan)?.label || sub.plan}
                    </span>
                    {st && <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>}
                  </div>
                  <div className="mt-1 text-sm text-ink-2">
                    {sub.status === "trial" ? "Fin del período de prueba: " : "Próximo vencimiento: "}
                    {fdate(vence)}
                  </div>
                </div>
                {sub.status === "past_due" && (
                  <div className="rounded-lg border border-[#f5b13d]/30 bg-[rgba(245,177,61,.1)] px-4 py-3 text-sm text-[#f5b13d]">
                    Tenés un pago pendiente. Contactanos para regularizar tu cuenta.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-ink-2">Todavía no tenés una suscripción configurada. Escribinos para activarla.</p>
            )}
          </div>

          <h2 className="mb-3 text-lg font-bold">Planes disponibles</h2>
          <p className="mb-4 text-sm text-muted">
            Estos planes los administra el equipo de GymCore. Si querés cambiar de plan, contactanos.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {SUB_PLANS.map((p) => {
              const isCurrent = sub?.plan === p.key;
              return (
                <div
                  key={p.key}
                  className={`relative flex flex-col rounded-2xl border p-5 ${isCurrent ? "border-brand bg-[rgba(34,211,238,.06)]" : "border-white/10 bg-surface"}`}
                >
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-black">
                      Tu plan actual
                    </span>
                  )}
                  <b className="text-lg">{p.label}</b>
                  <div className="my-2 text-3xl font-black tracking-tight">
                    {money(p.price)}<span className="text-sm font-normal text-muted">/mes</span>
                  </div>
                  <ul className="mt-2 flex-1 space-y-1.5 text-sm text-ink-2">
                    {p.features.map((f, i) => <li key={i}>✓ {f}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
