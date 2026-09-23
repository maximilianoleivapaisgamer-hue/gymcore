"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EtapaAbono } from "@/lib/abono";

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
  etapa: EtapaAbono;
  fecha_corte: string | null;
  es_dueno: boolean;
  aviso: { titulo: string; detalle: string } | null;
}

/** Qué tan fuerte se ve el aviso, según lo cerca que esté el corte. */
const TONOS: Record<string, string> = {
  "por-vencer": "border-[#f5b13d]/30 bg-[rgba(245,177,61,.08)] text-[#f5b13d]",
  "vence-hoy": "border-[#f5b13d]/40 bg-[rgba(245,177,61,.12)] text-[#f5b13d]",
  "vencido": "border-crit/30 bg-[rgba(240,82,82,.1)] text-crit",
  "aviso-corte": "border-crit/40 bg-[rgba(240,82,82,.14)] text-crit",
  "ultimo-aviso": "border-crit/60 bg-[rgba(240,82,82,.2)] text-crit",
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
          <div className="mb-4 text-5xl">🔒</div>
          <h1 className="text-2xl font-bold">{e.aviso.titulo}</h1>
          <p className="mt-2 text-ink-2">{e.aviso.detalle}</p>

          <Link href="/dashboard/mi-plan#abonar" className="btn btn-primary mt-6 inline-block px-6">
            Abonar ahora
          </Link>

          <p className="mt-5 text-xs leading-relaxed text-muted">
            Tus datos están todos guardados y tus socios siguen usando su app
            normalmente. Apenas registremos el pago, esto se abre solo.
          </p>
          <p className="mt-3 text-xs text-muted">
            ¿Ya pagaste o hay algún error?{" "}
            <Link href="/dashboard/mi-plan" className="text-brand hover:underline">
              Avisanos desde Mi plan
            </Link>
          </p>
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
      {e.es_dueno && (
        <Link href="/dashboard/mi-plan#abonar" className="btn btn-primary shrink-0 text-xs">
          Pagar ahora
        </Link>
      )}
    </div>
  );
}
