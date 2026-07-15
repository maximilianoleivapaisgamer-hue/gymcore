/**
 * Utilidades compartidas del panel Super Admin de turnogym.
 * (Sin "use client": son constantes y funciones puras que usan las páginas.)
 */

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
};

export const money = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-AR");
export const fdate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("es-AR") : "—");

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

/** ¿El abono está por vencer? (activo/trial, dentro de los próximos `dias` días). */
export function isProximoVence(
  sub: { status: string; trial_ends_at: string | null; current_period_end: string | null } | undefined,
  dias = 7
): boolean {
  if (!sub || (sub.status !== "active" && sub.status !== "trial")) return false;
  const d = daysUntil(venceOf(sub));
  return d !== null && d >= 0 && d <= dias;
}

/** ¿El abono ya venció? (activo/trial con fecha pasada). */
export function isVencido(
  sub: { status: string; trial_ends_at: string | null; current_period_end: string | null } | undefined
): boolean {
  if (!sub || (sub.status !== "active" && sub.status !== "trial")) return false;
  const d = daysUntil(venceOf(sub));
  return d !== null && d < 0;
}
