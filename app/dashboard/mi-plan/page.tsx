"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { WA_TARGET, waHrefBase, abrirWhatsapp } from "@/lib/wa-link";
import { estadoDeAbono } from "@/lib/admin";
import { loadPlans, loadGymExtras, isBonificada, featureLabel, DEFAULT_PLANS, type PlanConfig, type SubPlanKey, type PlanFeature } from "@/lib/plans";

interface Sub {
  plan: SubPlanKey;
  status: "trial" | "active" | "past_due" | "canceled";
  trial_ends_at: string | null;
  current_period_end: string | null;
  /** Cómo paga: define si tiene que abonar a mano o se le debita solo. */
  payment_method: "transferencia" | "mercadopago" | "gratis" | null;
  mp_preapproval_id: string | null;
}
interface TransferData { alias: string; cbu: string; titular: string; nota: string; whatsapp: string; }
interface Pendiente { id: string; plan: string; amount: number | null; status: string; created_at: string; }

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
/**
 * Los vencimientos vienen como timestamp a medianoche UTC. Pasarlos por
 * `new Date().toLocaleDateString()` los corre un día para atrás en Argentina
 * (UTC-3): el 20/09 se mostraba como 19/09, y el dueño creía que le vencía un
 * día antes. Tomamos la parte de fecha del texto, sin husos de por medio.
 */
const fdate = (s: string | null) => {
  if (!s) return "—";
  const [a, m, d] = String(s).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
};

/** Días que faltan para esa fecha. Negativo si ya pasó. */
const diasPara = (s: string | null): number | null => {
  if (!s) return null;
  const [a, m, d] = String(s).slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return null;
  const hoy = new Date();
  const objetivo = new Date(a, m - 1, d);
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((objetivo.getTime() - base.getTime()) / 86400000);
};

function CopyChip({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); })}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-left hover:border-white/20"
    >
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide text-muted">{label}</span>
        <span className="block truncate text-sm font-semibold">{value}</span>
      </span>
      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${ok ? "text-good" : "text-brand"}`}>{ok ? "✓ Copiado" : "Copiar"}</span>
    </button>
  );
}

/**
 * "Mi plan": el abono mensual del DUEÑO con turnogym (no confundir con los
 * planes de sus socios). El plan y estado los configura Maxi desde /admin;
 * acá el dueño solo ve en qué situación está.
 */
export default function MiPlanPage() {
  const supabase = createClient();
  const [sub, setSub] = useState<Sub | null>(null);
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS);
  /** Funciones que te habilitamos sin cargo, además de las del plan. */
  const [extras, setExtras] = useState<PlanFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState("");
  const [justPaid, setJustPaid] = useState(false);

  // Pago por transferencia
  const [transferData, setTransferData] = useState<TransferData | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [transferPlan, setTransferPlan] = useState<string | null>(null); // plan elegido → abre el panel
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [transferMsg, setTransferMsg] = useState("");
  const [sentOk, setSentOk] = useState(false);

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

  async function loadTransfer() {
    try {
      const res = await fetch("/api/pagos/transferencia").then((r) => r.json());
      if (res?.ok) {
        setTransferData(res.datos as TransferData);
        setPendiente((res.pendiente as Pendiente) || null);
      }
    } catch { /* noop */ }
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
          .from("subscriptions")
          .select("plan, status, trial_ends_at, current_period_end, payment_method, mp_preapproval_id")
          .eq("gym_id", profile.gym_id).single<Sub>();
        setSub(data ?? null);
        setExtras(await loadGymExtras(supabase, profile.gym_id));
      }
      await loadTransfer();
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  function openTransfer(plan: string) {
    setTransferPlan(plan);
    setReceiptUrl(""); setTransferMsg(""); setSentOk(false);
  }

  async function uploadReceipt(file: File) {
    setUploading(true); setTransferMsg("");
    try {
      const path = `comprobantes/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("gym-assets").upload(path, file, { upsert: true });
      if (error) { setTransferMsg("No se pudo subir el comprobante."); setUploading(false); return; }
      const { data } = supabase.storage.from("gym-assets").getPublicUrl(path);
      setReceiptUrl(data.publicUrl);
    } catch { setTransferMsg("No se pudo subir el comprobante."); }
    setUploading(false);
  }

  async function enviarComprobante() {
    if (!transferPlan || !receiptUrl) return;
    setSending(true); setTransferMsg("");
    try {
      const res = await fetch("/api/pagos/transferencia", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: transferPlan, receiptUrl }),
      }).then((r) => r.json());
      if (res?.ok) {
        setSentOk(true);
        setTransferPlan(null);
        await loadTransfer();
      } else {
        setTransferMsg(res?.error || "No se pudo enviar el comprobante.");
      }
    } catch { setTransferMsg("Falló la conexión. Probá de nuevo."); }
    setSending(false);
  }

  function waAvisar(planLabel: string): { href: string; phone: string; msg: string } | null {
    const phone = (transferData?.whatsapp || "").replace(/\D/g, "");
    if (!phone) return null;
    const msg = `¡Hola! Soy de ${sub ? "un negocio con turnogym" : "turnogym"}. Hice la transferencia del plan ${planLabel} y les paso el comprobante para adelantar el control. ¡Gracias!`;
    return { href: waHrefBase(phone, msg) as string, phone, msg };
  }

  // Mira el estado Y la fecha. `status` sola decia "Al dia" tres lineas arriba
  // de un cartel rojo que decia "tu abono vencio": el que paga por
  // transferencia nunca genera el webhook que moveria esa columna.
  const st = estadoDeAbono(sub ?? undefined);
  const vence = sub ? (sub.status === "trial" ? sub.trial_ends_at : sub.current_period_end) : null;
  // Funciones que le habilitamos a mano y que su plan NO trae. Las que ya vienen
  // con el plan no se listan acá: no son un regalo, son parte de lo que paga.
  const bonificadas = extras.filter((f) => isBonificada(plans, sub?.plan, f, extras));

  // ── ¿Este dueño tiene que pagar a mano, o se le debita solo? ─────────
  // Antes la tarjeta de su plan decía "Es tu plan actual" y nada más, así que
  // el que paga por transferencia no tenía NINGÚN botón para abonar el mes:
  // dependía de que le cobráramos nosotros.
  const debitoAutomatico = sub?.payment_method === "mercadopago" && !!sub?.mp_preapproval_id;
  const sinCargo = sub?.payment_method === "gratis";
  const diasRestantes = diasPara(vence);
  /** Le toca poner plata: ni bonificado ni con débito automático. */
  const tienePagar = !!sub && !sinCargo && !debitoAutomatico;
  /** Falta poco o ya venció: solo cambia el TONO, no si se muestra o no. */
  const apura = diasRestantes !== null && diasRestantes <= 7;
  const vencido = diasRestantes !== null && diasRestantes < 0;
  const precioActual = plans.find((x) => x.key === sub?.plan)?.price ?? 0;

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
      {sentOk && (
        <div className="mb-6 rounded-xl border border-good/30 bg-[rgba(34,197,94,.08)] px-4 py-3 text-sm text-good">
          ✅ Recibimos tu comprobante. Verificamos la transferencia y activamos tu plan en <b>hasta 48hs hábiles</b>. Si querés adelantarlo, avisanos por WhatsApp.
        </div>
      )}
      {pendiente && (
        <div className="mb-6 rounded-xl border border-brand/30 bg-[rgba(34,211,238,.07)] px-4 py-3 text-sm text-brand">
          ⏳ Tenés una transferencia <b>en revisión</b> (plan {plans.find((p) => p.key === pendiente.plan)?.label || pendiente.plan}
          {pendiente.amount ? ` · ${money(pendiente.amount)}` : ""}). La confirmamos en hasta 48hs hábiles.
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
                {/* Cómo se renueva, al lado del estado. */}
                {sub.status === "active" && (sinCargo || debitoAutomatico) && (
                  <div className="mt-1 text-xs text-muted">
                    {sinCargo
                      ? "Tu plan está bonificado: no tenés que abonar nada."
                      : "Se renueva solo con débito automático de Mercado Pago."}
                  </div>
                )}

                {sub.status === "past_due" && (
                  <div className="rounded-lg border border-[#f5b13d]/30 bg-[rgba(245,177,61,.1)] px-4 py-3 text-sm text-[#f5b13d]">
                    Tenés un pago pendiente. Contactanos para regularizar tu cuenta.
                  </div>
                )}

                {/* Funciones que le habilitamos sin cargo (gyms.extra_features). */}
                {bonificadas.length > 0 && (
                  <div className="w-full border-t border-white/10 pt-3">
                    <div className="text-xs uppercase tracking-wide text-muted">Funciones bonificadas</div>
                    <p className="mt-1 text-sm text-ink-2">
                      Además de todo lo que trae tu plan, te dejamos habilitado sin cargo:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {bonificadas.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1.5 rounded-full border border-good/30 bg-[rgba(34,197,94,.08)] px-3 py-1 text-sm font-semibold text-good"
                        >
                          <span aria-hidden>🎁</span> {featureLabel(f)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Abonar el plan que ya tiene ──────────────────────
                    Va acá abajo y no en "Planes disponibles": esa grilla es
                    para CAMBIAR de plan. El que solo quiere pagar su mes no
                    tiene que ponerse a comparar planes para encontrar el botón. */}
                {tienePagar && !pendiente && (
                  /* id="abonar": el aviso del dashboard linkea directo acá. */
                  <div id="abonar" className="w-full scroll-mt-24 border-t border-white/10 pt-3">
                    <div className="text-xs uppercase tracking-wide text-muted">
                      {sub.status === "trial" ? "Activá tu plan" : "Abonar tu plan"}
                    </div>

                    <p className={`mt-1 text-sm ${vencido ? "font-semibold text-crit" : apura ? "font-semibold text-[#f5b13d]" : "text-ink-2"}`}>
                      {sub.status === "trial"
                        ? <>Tu prueba termina el <b>{fdate(vence)}</b>. Aboná para seguir sin cortes.</>
                        : vencido
                          ? <>Tu abono venció el <b>{fdate(vence)}</b>. Aboná para que no se te corte el servicio.</>
                          : diasRestantes === 0
                            ? <>Tu abono <b>vence hoy</b>. Aboná para que no se te corte el servicio.</>
                            : <>
                                {plans.find((x) => x.key === sub.plan)?.label || sub.plan} · <b className="text-ink">{money(precioActual)}</b> por mes
                                {diasRestantes !== null && <> · vence en {diasRestantes} {diasRestantes === 1 ? "día" : "días"}</>}
                              </>}
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-surface-2 p-3">
                        <button className="btn btn-primary w-full" disabled={changing === sub.plan}
                          onClick={() => cambiar(sub.plan)}>
                          {changing === sub.plan ? "Redirigiendo…" : "💳 Pagar con Mercado Pago"}
                        </button>
                        <p className="mt-2 text-[11px] leading-snug text-muted">
                          Con dinero en cuenta, tarjeta de débito o de crédito.
                          Se activa al instante.
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-surface-2 p-3">
                        <button className="btn btn-ghost w-full" onClick={() => openTransfer(sub.plan)}>
                          🏦 Pagar por transferencia
                        </button>
                        <p className="mt-2 text-[11px] leading-snug text-muted">
                          Te damos el alias, subís el comprobante y lo activamos
                          en hasta 48hs hábiles.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-ink-2">Todavía no tenés una suscripción configurada. Escribinos para activarla.</p>
            )}
          </div>

          <h2 className="mb-3 text-lg font-bold">
            {sub ? "¿Querés cambiar de plan?" : "Planes disponibles"}
          </h2>
          <p className="mb-4 text-sm text-muted">
            {sub
              ? "Mirá qué suma cada plan. Al contratarlo abonás con Mercado Pago (dinero en cuenta, débito o crédito) o por transferencia."
              : "Elegí tu plan y aboná con Mercado Pago (dinero en cuenta, débito o crédito) o por transferencia."}
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

                  {isCurrent && sub?.status === "active" ? (
                    /* Esta grilla es para CAMBIAR de plan. Abonar el mes del plan
                       que ya tiene vive arriba, en la tarjeta de estado. */
                    <div className="mt-4 rounded-lg border border-white/10 py-2 text-center text-xs font-semibold text-ink-2">
                      {sinCargo
                        ? "Tu plan, sin cargo"
                        : debitoAutomatico
                          ? `Tu plan · se renueva solo el ${fdate(vence)}`
                          : "Es tu plan actual"}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {isCurrent && (
                        <p className="text-center text-[11px] font-semibold text-brand">Estás probando este plan · activalo para contratarlo</p>
                      )}
                      <button
                        className="btn btn-primary w-full"
                        disabled={changing === p.key}
                        onClick={() => cambiar(p.key)}
                      >
                        {changing === p.key ? "Redirigiendo a Mercado Pago…" : (isCurrent ? "💳 Contratar con Mercado Pago" : "💳 Pagar con Mercado Pago")}
                      </button>
                      <button
                        className="btn btn-ghost w-full"
                        onClick={() => openTransfer(p.key)}
                      >
                        🏦 {isCurrent ? "Contratar por transferencia" : "Pagar por transferencia"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Frase de valor, centrada debajo de los 3 planes */}
          <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-good/30 bg-[rgba(34,197,94,.08)] px-4 py-3 text-center text-sm font-semibold leading-snug text-good">
            💡 Por lo que te sale el abono de <b>un solo socio</b>, tenés todo este sistema profesional para sumar clientes y fidelizarlos.
          </div>
        </>
      )}

      {/* Panel de pago por transferencia */}
      {transferPlan && (() => {
        const planObj = plans.find((p) => p.key === transferPlan);
        const planLabel = planObj?.label || transferPlan;
        const wa = waAvisar(planLabel);
        const sinDatos = !transferData?.alias && !transferData?.cbu;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setTransferPlan(null)}>
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-bg p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-bold">Transferencia · {planLabel}</h3>
                <button className="text-muted hover:text-ink" onClick={() => setTransferPlan(null)}>✕</button>
              </div>

              {planObj && (
                <div className="mb-3 rounded-lg border border-brand/25 bg-[rgba(34,211,238,.06)] px-3 py-2 text-sm">
                  Monto a transferir: <b className="text-brand">{money(planObj.price)}</b> <span className="text-muted">/mes</span>
                </div>
              )}

              {sinDatos ? (
                <p className="rounded-lg border border-[#f5b13d]/30 bg-[rgba(245,177,61,.1)] px-3 py-2 text-sm text-[#f5b13d]">
                  Todavía no están cargados los datos para transferir. Escribinos por WhatsApp y te los pasamos.
                </p>
              ) : (
                <div className="space-y-2">
                  <CopyChip label="Alias" value={transferData?.alias || ""} />
                  <CopyChip label="CBU / CVU" value={transferData?.cbu || ""} />
                  {transferData?.titular && (
                    <div className="rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm">
                      <span className="block text-[11px] uppercase tracking-wide text-muted">Titular</span>
                      <span className="block font-semibold">{transferData.titular}</span>
                    </div>
                  )}
                  {transferData?.nota && <p className="text-xs text-ink-2">{transferData.nota}</p>}
                </div>
              )}

              <div className="mt-4 rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-xs text-ink-2">
                ⏱️ Las transferencias se acreditan en <b>hasta 48hs hábiles</b> porque verificamos el pago. Para adelantar el control, avisanos por WhatsApp con el comprobante.
              </div>

              {/* Subir comprobante */}
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold text-ink-2">Comprobante de la transferencia</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="text-sm"
                  onChange={(e) => e.target.files?.[0] && uploadReceipt(e.target.files[0])}
                />
                {uploading && <p className="mt-1 text-xs text-muted">Subiendo…</p>}
                {receiptUrl && !uploading && <p className="mt-1 text-xs text-good">Comprobante cargado ✓</p>}
              </div>

              {transferMsg && <p className="mt-3 text-sm text-crit">{transferMsg}</p>}

              <button
                className="btn btn-primary mt-4 w-full"
                disabled={!receiptUrl || sending}
                onClick={enviarComprobante}
              >
                {sending ? "Enviando…" : "Ya transferí — enviar comprobante"}
              </button>

              {wa && (
                <a
                  href={wa.href}
                  target={WA_TARGET}
                  rel="noreferrer"
                  onClick={(e) => abrirWhatsapp(e, wa.phone, wa.msg)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#25D366]/40 py-2.5 text-sm font-semibold text-[#25D366] hover:bg-[rgba(37,211,102,.12)]"
                >
                  💬 Avisar por WhatsApp
                </a>
              )}
              <p className="mt-2 text-center text-[11px] text-muted">Tu plan se activa cuando confirmamos la transferencia.</p>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
