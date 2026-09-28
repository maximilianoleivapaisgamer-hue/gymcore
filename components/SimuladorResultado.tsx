"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Así podés llegar a estar en 3 y 6 meses."
 *
 * El mismo componente sirve para los dos lados, que es a propósito: si fueran
 * dos, tarde o temprano uno muestra el consentimiento y el otro no.
 *
 *   <SimuladorResultado memberId={id} />  → el gimnasio, desde la ficha del
 *      socio. Es el momento de la VENTA: la persona está en el mostrador.
 *
 *   <SimuladorResultado />                → el socio, desde su app. Es la
 *      MOTIVACIÓN, y el camino que se comparte.
 *
 * ⚠️ El consentimiento NO es un checkbox de trámite. Sin tildarlo el botón no
 * se habilita, y el texto que se muestra es el mismo que queda guardado en la
 * base con fecha. Es una foto del cuerpo de una persona.
 */

interface Hecha {
  id: string; meses: number; foto_url: string; imagen_url: string | null;
  peso_desde: number | null; peso_hasta: number | null; enfoque: string | null; created_at: string;
}
interface Estado {
  habilitado: boolean; disponible: boolean; consentimiento: string;
  es_socio: boolean; member_id: string | null;
  espera: { tres: { puede: boolean; dias: number }; seis: { puede: boolean; dias: number } } | null;
  usadas: number; tope: number; quedan: number;
  hechas: Hecha[];
}

/**
 * En el mostrador va SOLO la de 3 meses; el socio, desde su app, puede las dos.
 *
 * Por dos razones. Una: son dos imagenes por persona, y con 50 altas al mes eso
 * duplica el costo del gimnasio al pedo. La otra es mejor todavia: si la de 6
 * meses se la tiene que generar el mismo, le estas dando un motivo concreto
 * para abrir la app el primer dia — que es justo lo que queres que haga.
 */
const PLAZOS_GIMNASIO = [3] as const;
const PLAZOS_SOCIO = [3, 6] as const;

export default function SimuladorResultado({ memberId }: { memberId?: string }) {
  const [e, setE] = useState<Estado | null>(null);
  const [foto, setFoto] = useState<{ data: string; tipo: string } | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [meses, setMeses] = useState<3 | 6>(3);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function cargar() {
    try {
      const r = await fetch(`/api/panel/simulacion${memberId ? `?member_id=${memberId}` : ""}`);
      const j = await r.json();
      if (j.ok) setE(j as Estado);
    } catch { /* sin esto la pantalla simplemente no muestra el simulador */ }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [memberId]);

  function elegirFoto(f: File | undefined) {
    if (!f) return;
    setError("");
    if (!f.type.startsWith("image/")) { setError("Eso no es una imagen."); return; }
    if (f.size > 8 * 1024 * 1024) { setError("La foto no puede pesar más de 8 MB."); return; }
    const lector = new FileReader();
    lector.onload = () => setFoto({ data: String(lector.result), tipo: f.type });
    lector.readAsDataURL(f);
  }

  async function generar() {
    if (!foto || !acepta) return;
    setGenerando(true); setError("");
    try {
      const r = await fetch("/api/panel/simulacion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ member_id: memberId, meses, foto: foto.data, tipo: foto.tipo, acepta: true }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || "No se pudo generar.");
      else { setFoto(null); setAcepta(false); await cargar(); }
    } catch {
      setError("No se pudo generar. Probá de nuevo.");
    }
    setGenerando(false);
  }

  if (!e || !e.habilitado) return null;

  const plazos = e.es_socio ? PLAZOS_SOCIO : PLAZOS_GIMNASIO;
  const espera = meses === 3 ? e.espera?.tres : e.espera?.seis;
  const bloqueadoPorEspera = espera && !espera.puede;
  const sinCupo = e.quedan <= 0;

  return (
    <section className="card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Cómo podés llegar a estar</h3>
        {!e.es_socio && (
          <span className="text-[11px] text-muted">{e.quedan} de {e.tope} este mes</span>
        )}
      </div>
      <p className="mb-4 text-xs leading-snug text-ink-2">
        {e.es_socio
          ? "Sacate una foto y mirá una imagen orientativa de cómo podrías verte siguiendo tu plan."
          : "Sacale una foto y mostrale, en el momento, a dónde puede llegar en 3 meses. La de 6 meses se la genera ella misma desde su app."}
      </p>

      {/* Las que ya tiene */}
      {e.hechas.length > 0 && (
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          {e.hechas.filter((h) => h.imagen_url).map((h) => (
            <figure key={h.id} className="overflow-hidden rounded-xl border border-white/10">
              <div className="grid grid-cols-2">
                <img src={h.foto_url} alt="Hoy" className="aspect-[3/4] w-full object-cover" />
                <img src={h.imagen_url as string} alt={`En ${h.meses} meses`} className="aspect-[3/4] w-full object-cover" />
              </div>
              <figcaption className="px-3 py-2 text-[11px] leading-snug text-ink-2">
                <b className="text-ink">Hoy · en {h.meses} meses</b>
                {h.peso_desde && h.peso_hasta && h.enfoque !== "recomposicion" && (
                  <> — de {h.peso_desde} kg a {h.peso_hasta} kg</>
                )}
                {h.enfoque === "recomposicion" && <> — mismo peso, otra forma</>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {!e.disponible ? (
        <p className="rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-xs text-ink-2">
          El simulador todavía no está configurado. Escribinos y lo dejamos andando.
        </p>
      ) : (
        <>
          <div className={`mb-3 flex flex-wrap items-center gap-2 ${plazos.length === 1 ? "hidden" : ""}`}>
            {plazos.map((m) => (
              <button key={m} type="button" onClick={() => setMeses(m)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  meses === m ? "bg-brand text-[#04121a]" : "border border-white/15 text-ink-2 hover:border-white/30"
                }`}>
                {m} meses
              </button>
            ))}
          </div>

          {/* `capture` abre la cámara directo en el teléfono, que es donde se usa. */}
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(ev) => elegirFoto(ev.target.files?.[0])} />

          {foto ? (
            <div className="flex flex-wrap items-start gap-3">
              <img src={foto.data} alt="" className="h-32 w-24 rounded-lg object-cover" />
              <button type="button" className="btn btn-ghost text-xs" onClick={() => setFoto(null)}>
                Sacar otra
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost text-sm" onClick={() => input.current?.click()}>
              📷 {e.es_socio ? "Sacarme una foto" : "Sacar la foto"}
            </button>
          )}

          {foto && (
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/10 bg-white/[.03] p-3">
              <input type="checkbox" checked={acepta} onChange={(ev) => setAcepta(ev.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--brand-rgb))]" />
              <span className="text-[11px] leading-relaxed text-ink-2">{e.consentimiento}</span>
            </label>
          )}

          {(bloqueadoPorEspera || sinCupo) && (
            <p className="mt-3 text-xs text-[#f5b13d]">
              {sinCupo
                ? `Se usaron las ${e.tope} simulaciones de este mes. Se renueva el 1°.`
                : `Ya hay una de ${meses} meses hecha hace poco. Se puede hacer otra en ${espera?.dias} ${espera?.dias === 1 ? "día" : "días"}.`}
            </p>
          )}
          {error && <p className="mt-3 text-xs text-crit">{error}</p>}

          {foto && (
            <button className="btn btn-primary mt-4 text-sm"
              disabled={!acepta || generando || !!bloqueadoPorEspera || sinCupo}
              onClick={generar}>
              {generando ? "Generando… (tarda unos segundos)" : `Ver cómo podría estar en ${meses} meses`}
            </button>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            La imagen es <b>orientativa</b> y no garantiza ningún resultado: los resultados
            reales dependen de la constancia, la alimentación, la salud y la genética de cada
            persona. Se calcula con el peso y la altura cargados, y la aclaración queda impresa
            en la imagen.
          </p>
        </>
      )}
    </section>
  );
}
