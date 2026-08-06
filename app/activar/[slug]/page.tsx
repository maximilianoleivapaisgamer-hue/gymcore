"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppBackground from "@/components/AppBackground";
import { BrandMark } from "@/components/BrandMark";

interface Plan { key: string; label: string; price: number; tagline?: string; features?: string[] }
interface Data {
  gym: { name: string; slug: string; logo: string | null };
  yaActivo: boolean;
  ownerUser: string;
  planes: Plan[];
  mp: boolean;
  transfer: { alias: string; cbu: string; titular: string; nota: string; whatsapp: string };
}

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-AR");

export default function ActivarPage() {
  const slug = String(useParams()?.slug || "");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [plan, setPlan] = useState("pro");
  const [email, setEmail] = useState("");
  const [metodo, setMetodo] = useState<"suscripcion" | "pago" | "transfer">("suscripcion");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/pagos/activar?slug=${encodeURIComponent(slug)}`).then((x) => x.json()).catch(() => null);
      if (r?.ok) {
        setData(r);
        if (!r.mp) setMetodo("transfer");
        // Elegimos "pro" si existe, si no el primero.
        const keys = (r.planes || []).map((p: Plan) => p.key);
        setPlan(keys.includes("pro") ? "pro" : (keys[0] || "basico"));
      } else setErr(r?.error || "No se pudo cargar la activación.");
      setLoading(false);
    })();
  }, [slug]);

  async function pagar(m: "suscripcion" | "pago") {
    setErr("");
    if (!email.includes("@")) { setErr("Escribí tu email para el pago."); return; }
    setPaying(true);
    const r = await fetch("/api/pagos/activar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, plan, email: email.trim(), metodo: m }),
    }).then((x) => x.json()).catch(() => null);
    setPaying(false);
    if (r?.ok && r.init_point) { window.location.href = r.init_point; return; }
    setErr(r?.error || "No se pudo iniciar el pago.");
  }

  const planActual = data?.planes.find((p) => p.key === plan);
  const waTransfer = data?.transfer.whatsapp
    ? `https://wa.me/${data.transfer.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, transferí el abono del plan ${planActual?.label || plan} para activar ${data?.gym.name}. Te paso el comprobante 👇`)}`
    : null;

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <AppBackground style="aurora" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          {data?.gym.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.gym.logo} alt="" className="mx-auto mb-3 h-14 w-14 rounded-2xl object-contain" />
          ) : (
            <BrandMark size={52} className="mx-auto mb-3 rounded-2xl" />
          )}
          <h1 className="text-2xl font-bold">Activá {data?.gym.name || "tu gimnasio"}</h1>
          <p className="mt-1 text-sm text-ink-2">Al pagar, tu gimnasio queda activo y <b>tu web y tu app quedan online con tu marca</b>. No perdés nada de lo que ya viste.</p>
        </div>

        {loading ? (
          <div className="card text-center text-ink-2">Cargando…</div>
        ) : data?.yaActivo ? (
          <div className="card text-center">
            <div className="mb-2 text-3xl">✅</div>
            <p className="text-sm">Este gimnasio ya está activo. Entrá con tu usuario y contraseña:</p>
            {data.ownerUser && <p className="mt-2 text-lg font-bold">{data.ownerUser}</p>}
            <a href="/acceso" className="btn btn-primary mt-4 inline-block">Ir a iniciar sesión</a>
          </div>
        ) : !data ? (
          <div className="card text-center text-crit">{err || "No se pudo cargar."}</div>
        ) : (
          <div className="card flex flex-col gap-4">
            {/* Plan */}
            <div>
              <div className="mb-1.5 text-sm font-semibold">Elegí tu plan</div>
              <div className="flex flex-col gap-2">
                {data.planes.map((p) => (
                  <button key={p.key} type="button" onClick={() => setPlan(p.key)}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${plan === p.key ? "border-brand/50 bg-[rgba(34,211,238,.08)]" : "border-white/10 hover:border-white/20"}`}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{p.label}</div>
                      {p.tagline && <div className="truncate text-xs text-ink-2">{p.tagline}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold">{money(p.price)}</div>
                      <div className="text-[10px] text-muted">por mes</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Método */}
            <div>
              <div className="mb-1.5 text-sm font-semibold">Cómo querés pagar</div>
              <div className="flex flex-col gap-2">
                {data.mp && (
                  <button type="button" onClick={() => setMetodo("suscripcion")}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${metodo === "suscripcion" ? "border-brand/50 bg-[rgba(34,211,238,.1)] text-brand" : "border-white/10 text-ink-2"}`}>
                    <span>🔁 Suscripción <span className="text-xs font-normal text-ink-2">· se debita solo cada mes</span></span>
                    <span className="shrink-0 rounded-full bg-[rgba(34,197,94,.14)] px-2 py-0.5 text-[10px] font-bold text-good">Recomendado</span>
                  </button>
                )}
                {data.mp && (
                  <button type="button" onClick={() => setMetodo("pago")}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${metodo === "pago" ? "border-brand/50 bg-[rgba(34,211,238,.1)] text-brand" : "border-white/10 text-ink-2"}`}>
                    💳 Pago con Mercado Pago <span className="text-xs font-normal text-ink-2">· un pago</span>
                  </button>
                )}
                <button type="button" onClick={() => setMetodo("transfer")}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${metodo === "transfer" ? "border-brand/50 bg-[rgba(34,211,238,.1)] text-brand" : "border-white/10 text-ink-2"}`}>
                  🏦 Transferencia
                </button>
              </div>
            </div>

            {metodo !== "transfer" ? (
              <div className="flex flex-col gap-2">
                <input className="input" type="email" placeholder="Tu email (para el pago)" value={email} onChange={(e) => setEmail(e.target.value)} />
                {err && <p className="text-sm text-crit">{err}</p>}
                <button className="btn btn-primary" onClick={() => pagar(metodo === "pago" ? "pago" : "suscripcion")} disabled={paying}>
                  {paying ? "Redirigiendo…" : metodo === "pago" ? `Pagar ${money(planActual?.price || 0)} con Mercado Pago` : `Suscribirme por ${money(planActual?.price || 0)}/mes`}
                </button>
                <p className="text-center text-[11px] text-muted">
                  {metodo === "pago"
                    ? "Un pago con Mercado Pago (tarjeta o dinero en cuenta). Tu gimnasio queda activo al acreditarse."
                    : "Autorizás el débito automático en Mercado Pago. Apenas se acredita, tu gimnasio queda activo solo."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                {data.transfer.alias || data.transfer.cbu ? (
                  <>
                    <div className="mb-1 font-semibold">Transferí {money(planActual?.price || 0)} a:</div>
                    {data.transfer.alias && <div>Alias: <b className="text-ink">{data.transfer.alias}</b></div>}
                    {data.transfer.cbu && <div>CBU: <b className="text-ink">{data.transfer.cbu}</b></div>}
                    {data.transfer.titular && <div className="text-ink-2">Titular: {data.transfer.titular}</div>}
                    {data.transfer.nota && <div className="mt-1 text-xs text-muted">{data.transfer.nota}</div>}
                    <p className="mt-2 text-xs text-ink-2">Después mandanos el comprobante y activamos tu gimnasio (hasta 48hs hábiles).</p>
                    {waTransfer && <a href={waTransfer} target="_blank" rel="noreferrer" className="btn btn-primary mt-2 inline-block w-full text-center">Enviar comprobante por WhatsApp</a>}
                  </>
                ) : (
                  <p className="text-ink-2">Escribinos y te pasamos los datos para transferir.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
