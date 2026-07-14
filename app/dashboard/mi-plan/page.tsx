"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { SUB_STATUS_LABEL } from "@/types/db";
import { loadPlans, DEFAULT_PLANS, type PlanConfig, type SubPlanKey } from "@/lib/plans";

interface Sub {
  plan: SubPlanKey;
  status: "trial" | "active" | "past_due" | "canceled";
  trial_ends_at: string | null;
  current_period_end: string | null;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const fdate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-AR") : "—");

/**
 * "Mi plan": el abono mensual del DUEÑO con turnogym (no confundir con los
 * planes de sus socios). El plan y estado los configura Maxi desde /admin;
 * acá el dueño solo ve en qué situación está.
 */
export default function MiPlanPage() {
  const supabase = createClient();
  const [sub, setSub] = useState<Sub | null>(null);
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState("");
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mp") === "ok") {
      setJustPaid(true);
    }
  }, []);

  async function cambiar(plan: string) {
    setChanging(plan); setPayMsg("");
    try {
      const res = await fetch("/api/pagos/crear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.ok && data.init_point) { window.location.href = data.init_point; return; }
      setPayMsg(data.error || "No se pudo iniciar el pago.");
    } catch {
      setPayMsg("Falló la conexión. Probá de nuevo.");
    }
    setChanging(null);
  }

  useEffect(() => {
    (async () => {
      setPlans(await loadPlans(supabase));
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
    <main className="p-5 md:p-7">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
          <Link href="/dashboard" className="hover:text-brand">Panel</Link>
          <span>/</span><span>Mi plan</span>
        </div>
        <h1 className="text-2xl font-bold">Mi plan</h1>
        <p className="text-ink-2">Tu abono mensual con turnogym.</p>
      </div>

      {justPaid && (
        <div className="mb-6 rounded-xl border border-good/30 bg-[rgba(34,197,94,.08)] px-4 py-3 text-sm text-good">
          ¡Gracias! Estamos confirmando tu pago con Mercado Pago. Tu plan se activa en unos minutos; si no ves el cambio, refrescá esta página.
        </div>
      )}
      {payMsg && (
        <div className="mb-6 rounded-xl border border-[#f5b13d]/30 bg-[rgba(245,177,61,.1)] px-4 py-3 text-sm text-[#f5b13d]">
          {payMsg}
        </div>
      )}

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
                      {plans.find((p) => p.key === sub.plan)?.label || sub.plan}
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
            Elegí tu plan y aboná con Mercado Pago (débito automático mensual). El cambio se activa solo apenas
            se confirma el pago.
          </p>
          <div className="grid items-start gap-5 md:grid-cols-3">
            {plans.map((p) => {
              const isCurrent = sub?.plan === p.key;
              const hasIA = p.capabilities?.includes("ia");
              return (
                <div
                  key={p.key}
                  className={`relative flex flex-col rounded-2xl border p-6 ${
                    isCurrent
                      ? "border-brand bg-[rgba(34,211,238,.06)]"
                      : hasIA
                        ? "border-[#a78bfa]/50 bg-gradient-to-b from-[rgba(139,92,246,.08)] to-surface shadow-[0_0_45px_-14px_rgba(139,92,246,.6)]"
                        : p.featured
                          ? "border-brand/60 bg-surface"
                          : "border-white/10 bg-surface"
                  }`}
                >
                  {/* Listón diagonal de IA (esquina) */}
                  {hasIA && (
                    <div className="pointer-events-none absolute right-0 top-0 h-[86px] w-[86px] overflow-hidden rounded-tr-2xl">
                      <div className="absolute -right-[34px] top-[16px] w-[130px] rotate-45 bg-gradient-to-r from-[#8b5cf6] to-brand py-1 text-center text-[10px] font-bold uppercase tracking-[1.5px] text-white shadow-md">
                        Con IA
                      </div>
                    </div>
                  )}

                  {(isCurrent || p.featured) && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-black">
                      {isCurrent ? "Tu plan actual" : "Más elegido"}
                    </span>
                  )}

                  <b className="text-lg">{p.label}</b>
                  <p className="mt-0.5 text-xs text-muted">{p.tagline}</p>

                  {/* Precio (con promo si corresponde) */}
                  <div className="my-3">
                    {p.promo_price ? (
                      <>
                        <div className="text-3xl font-black tracking-tight">
                          {money(p.promo_price)}
                          <span className="text-sm font-normal text-muted"> 1er mes</span>
                        </div>
                        <div className="text-sm text-muted">
                          luego <span className="line-through">{money(p.price)}</span> /mes
                        </div>
                      </>
                    ) : (
                      <div className="text-3xl font-black tracking-tight">
                        {money(p.price)}<span className="text-sm font-normal text-muted">/mes</span>
                      </div>
                    )}
                  </div>

                  {/* Cartel de IA */}
                  {hasIA && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#a78bfa]/30 bg-gradient-to-r from-[rgba(139,92,246,.14)] to-[rgba(34,211,238,.10)] px-3 py-2 text-xs font-bold text-white">
                      <span className="text-sm">🤖</span> IA que genera rutinas y dietas
                    </div>
                  )}

                  <ul className="mt-1 flex-1 space-y-2 text-sm text-ink-2">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 text-good">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {p.promo_note && <p className="mt-3 text-[11px] text-muted">{p.promo_note}</p>}

                  {isCurrent ? (
                    <div className="mt-4 rounded-lg border border-white/10 py-2 text-center text-xs font-semibold text-ink-2">
                      Es tu plan actual
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary mt-4 w-full"
                      disabled={changing === p.key}
                      onClick={() => cambiar(p.key)}
                    >
                      {changing === p.key ? "Redirigiendo a Mercado Pago…" : `Cambiar a ${p.label}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
