"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EtapaAbono } from "@/lib/abono";
import { WA_TARGET } from "@/lib/wa-link";

/**
 * El estado del abono del gimnasio, en todas las pantallas del panel.
 *
 * Hace dos cosas con un solo dato, que es justamente el punto:
 *
 *   hasta el día 4  → una barra arriba, con el tono según lo cerca que esté
 *   del día 5       → un cartel que TAPA el panel y solo deja ir a pagar
 *
 * Antes esto vivía en dos lugares y con dos cuentas distintas, y terminó
 * mostrando "Al día" en verde arriba de "tu abono venció" en rojo. Ahora la
 * cuenta la hace el servidor (`/api/panel/abono`) y acá solo se dibuja.
 *
 * ⚠️ El bloqueo es COMERCIAL, no de seguridad: lo que hay detrás son los datos
 * del propio negocio. Es para que no se pueda usar el panel sin pagar, no para
 * esconder información de nadie.
 */

interface Estado {
  cortar: boolean;
  /** Mando el comprobante y esta esperando revision. */
  comprobante_pendiente: boolean;
  /** Link de WhatsApp a soporte, si esta cargado. */
  soporte: string | null;
  etapa: EtapaAbono;
  fecha_corte: string | null;
  es_dueno: boolean;
  aviso: { titulo: string; detalle: string } | null;
}

/**
 * Qué tan fuerte se ve el aviso.
 *
 * El rojo se guarda para el último día nomás. Un cartel rojo el día 3, cuando
 * todavía faltan dos y lo más probable es que simplemente se le haya pasado la
 * fecha, no suma urgencia: suma bronca. El amarillo alcanza para que lo vea.
 */
const TONOS: Record<string, string> = {
  "por-vencer": "border-white/10 bg-white/[.03] text-ink",
  "vence-hoy": "border-[#f5b13d]/30 bg-[rgba(245,177,61,.08)] text-[#f5b13d]",
  "vencido": "border-[#f5b13d]/40 bg-[rgba(245,177,61,.12)] text-[#f5b13d]",
  "aviso-corte": "border-[#f5b13d]/50 bg-[rgba(245,177,61,.16)] text-[#f5b13d]",
  "ultimo-aviso": "border-crit/50 bg-[rgba(240,82,82,.16)] text-crit",
  // Este es el unico en verde: mando el comprobante, esta todo bien.
  "comprobante": "border-good/40 bg-[rgba(34,197,94,.12)] text-good",
};

export default function EstadoAbono() {
  const [e, setE] = useState<Estado | null>(null);

  useEffect(() => {
    fetch("/api/panel/abono")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setE(j as Estado); })
      .catch(() => { /* si no se puede saber, no se molesta ni se bloquea */ });
  }, []);

  if (!e || !e.aviso) return null;

  // ── Cortado: se tapa el panel ──────────────────────────────────────────
  // Solo al dueño. Al empleado no se le cobra nada y no tiene cómo pagar: que
  // se quede sin trabajar por una deuda que no es suya sería castigarlo a él.
  if (e.cortar && e.es_dueno) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0a0d12]/95 px-6 backdrop-blur-sm">
        <div className="w-full max-w-md text-center">
          {/* Una pausa, no un candado: el dibujo tambien habla. */}
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[.04] text-3xl">
            ⏸️
          </div>
          <h1 className="text-2xl font-bold">{e.aviso.titulo}</h1>
          <p className="mt-2 leading-relaxed text-ink-2">{e.aviso.detalle}</p>

          <Link href="/dashboard/mi-plan#abonar" className="btn btn-primary mt-6 inline-block px-6">
            Abonar y seguir
          </Link>

          <p className="mt-5 text-xs leading-relaxed text-muted">
            Tus socios siguen usando su app con total normalidad. Esto es solo
            para vos, y se destraba en el momento en que entre el pago.
          </p>

          {e.soporte && (
            <p className="mt-4 text-xs text-muted">
              ¿Ya pagaste, o se te complicó este mes?{" "}
              <a href={e.soporte} target={WA_TARGET} rel="noreferrer" className="text-brand hover:underline">
                Escribinos y lo vemos
              </a>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (e.cortar) return null;  // empleado de un gimnasio cortado: sigue trabajando

  // ── Todavía a tiempo: la barra de arriba ───────────────────────────────
  const tono = TONOS[e.etapa] || TONOS["por-vencer"];
  const urgente = e.etapa === "ultimo-aviso" || e.etapa === "aviso-corte";

  return (
    <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${tono}`}>
      <div className="min-w-0">
        <div className={`text-sm ${urgente ? "font-bold" : "font-semibold"}`}>{e.aviso.titulo}</div>
        <p className="mt-0.5 text-xs leading-snug text-ink-2">{e.aviso.detalle}</p>
      </div>
      {/* Con el comprobante mandado no va ningun boton: ya hizo lo suyo.
          Ofrecerle "Abonar" seria pedirle que pague dos veces. */}
      {e.es_dueno && e.etapa !== "comprobante" && (
        <div className="flex shrink-0 items-center gap-2">
          {/* La salida a mano aparece recien cuando la cosa aprieta: antes de
              eso es solo un recordatorio y no hace falta ofrecer nada. */}
          {e.soporte && urgente && (
            <a href={e.soporte} target={WA_TARGET} rel="noreferrer"
              className="btn btn-ghost text-xs">
              Escribinos
            </a>
          )}
          <Link href="/dashboard/mi-plan#abonar" className="btn btn-primary text-xs">
            Abonar
          </Link>
        </div>
      )}
    </div>
  );
}
