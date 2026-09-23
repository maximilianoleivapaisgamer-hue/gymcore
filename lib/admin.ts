/**
 * Utilidades compartidas del panel Super Admin de turnogym.
 * (Sin "use client": son constantes y funciones puras que usan las páginas.)
 */

import { SUB_STATUS_LABEL } from "@/types/db";

export const PLAN_LABEL: Record<string, string> = { basico: "Básico", pro: "Pro", elite: "Elite" };

/** Respaldo de precios si un plan no tuviera precio configurado en la base. */
export const PLAN_PRICES: Record<string, number> = { basico: 49000, pro: 79000, elite: 119000 };

export const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Activo", cls: "bg-[rgba(34,197,94,.14)] text-good" },
  trial: { label: "Trial", cls: "bg-[rgba(34,211,238,.14)] text-brand" },
  past_due: { label: "Impago", cls: "bg-[rgba(245,177,61,.14)] text-warn" },
  canceled: { label: "Cancelado", cls: "bg-[rgba(240,82,82,.14)] text-crit" },
};

export const METHOD_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
  gratis: "Sin cobro",
};

export const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-AR");
/**
 * Fecha de vencimiento, sin que se corra un día.
 *
 * Vienen como timestamp a medianoche UTC: pasarlas por `new Date()` las mueve
 * al día anterior en Argentina (UTC-3). El 20/09 se mostraba 19/09 — y esa
 * fecha equivocada viajaba en el WhatsApp que le mandamos al cliente.
 */
export const fdate = (s: string | null | undefined) => {
  if (!s) return "—";
  const [a, m, d] = String(s).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
};

/** Fecha de vencimiento relevante según el estado (trial usa trial_ends_at). */
export function venceOf(sub: { status: string; trial_ends_at: string | null; current_period_end: string | null } | undefined): string | null {
  if (!sub) return null;
  return sub.status === "trial" ? sub.trial_ends_at : sub.current_period_end;
}

/** Días que faltan hasta una fecha (negativo si ya pasó). null si no hay fecha. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

/**
 * ¿El abono de un cliente que paga está por vencer?
 *
 * Mira SOLO los `active`, a propósito. La prueba gratis dura 7 días y esta
 * ventana también era de 7: toda cuenta nueva aparecía en "Abonos por vencer"
 * el mismo día que se registraba, mezclada con los clientes de verdad. Las
 * pruebas ahora avisan por su cuenta, en `isTrialPorTerminar`.
 */
export function isProximoVence(
  sub: { status: string; trial_ends_at: string | null; current_period_end: string | null } | undefined,
  dias = 7
): boolean {
  if (!sub || sub.status !== "active") return false;
  const d = daysUntil(venceOf(sub));
  return d !== null && d >= 0 && d <= dias;
}

/** ¿El abono de un cliente que paga ya venció? */
export function isVencido(
  sub: { status: string; trial_ends_at: string | null; current_period_end: string | null } | undefined
): boolean {
  if (!sub || sub.status !== "active") return false;
  const d = daysUntil(venceOf(sub));
  return d !== null && d < 0;
}

/**
 * El estado REAL del abono, mirando también la fecha.
 *
 * ⚠️ `subscriptions.status` es una columna guardada, y lo único que la mueve a
 * "past_due" es el webhook de Mercado Pago. El que paga por TRANSFERENCIA no
 * genera ningún webhook, así que se queda en "active" para siempre por más que
 * el vencimiento haya pasado hace meses.
 *
 * Eso hacía que en "Mi plan" el cliente viera el cartel verde **"Al día"** y
 * tres líneas más abajo, en rojo, **"Tu abono venció el 20/09"**. Las dos cosas
 * juntas, en la misma pantalla. Pasó con DanzArte.
 *
 * Devuelve la etiqueta que hay que mostrar. No toca nada ni corta nada: es solo
 * lo que se ve.
 */
export function estadoDeAbono(
  sub: { status: string; trial_ends_at: string | null; current_period_end: string | null } | undefined,
): { label: string; cls: string } | null {
  if (!sub) return null;

  const d = daysUntil(venceOf(sub));
  const paso = d !== null && d < 0;

  if (sub.status === "active" && paso) {
    return { label: "Vencido", cls: "bg-[rgba(240,82,82,.14)] text-crit" };
  }
  if (sub.status === "trial" && paso) {
    return { label: "Prueba terminada", cls: "bg-[rgba(245,177,61,.14)] text-warn" };
  }
  return SUB_STATUS_LABEL[sub.status] ?? null;
}

/**
 * Prueba gratis que se está terminando.
 *
 * Avisa recién sobre el final: el día que alguien se registra no hay nada que
 * hacer, y ese aviso temprano era justamente el que ensuciaba el tablero.
 */
export function isTrialPorTerminar(
  sub: { status: string; trial_ends_at: string | null; current_period_end: string | null } | undefined,
  dias = 2
): boolean {
  if (!sub || sub.status !== "trial") return false;
  const d = daysUntil(venceOf(sub));
  return d !== null && d >= 0 && d <= dias;
}

/** Prueba que ya se terminó sin convertirse en cliente. */
export function isTrialVencido(
  sub: { status: string; trial_ends_at: string | null; current_period_end: string | null } | undefined
): boolean {
  if (!sub || sub.status !== "trial") return false;
  const d = daysUntil(venceOf(sub));
  return d !== null && d < 0;
}
