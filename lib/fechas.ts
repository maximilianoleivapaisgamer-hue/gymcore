/** Fechas y montos de cuota. Se usa en Finanzas y en la ficha del socio, así
 *  los dos calculan igual. */

/** Cómo cobra el negocio (se configura en Configuración → Cobros). */
export interface CobroConfig {
  /** 'aniversario': +1 mes desde el vencimiento de cada socio (default).
   *  'dia_fijo': todos vencen el mismo día del mes. */
  cobro_modo?: string | null;
  /** Día del mes cuando el modo es 'dia_fijo'. */
  cobro_dia?: number | null;
  /** Recargo por pagar tarde: null, 'monto' (pesos) o 'porcentaje'. */
  recargo_tipo?: string | null;
  recargo_valor?: number | null;
}

/** Hoy en Argentina, como "YYYY-MM-DD". No usar `new Date()` a secas: en el
 *  servidor da UTC y de noche puede caer al día siguiente. */
export function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** Suma meses a "YYYY-MM-DD" recortando el día como hace Postgres
 *  (31/01 + 1 mes = 28/02, no 03/03). */
export function sumarMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ay = Math.floor(total / 12);
  const am = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(ay, am, 0)).getUTCDate();
  const ad = Math.min(d, ultimoDia);
  return `${ay}-${String(am).padStart(2, "0")}-${String(ad).padStart(2, "0")}`;
}

/** El día `dia` del mes, en el mes de `iso`. */
function conDia(iso: string, dia: number): string {
  const [y, m] = iso.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = Math.min(Math.max(1, dia), ultimoDia);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** La próxima vez que caiga el día `dia`, estrictamente después de `desde`. */
function proximoDiaFijo(desde: string, dia: number): string {
  const esteMes = conDia(desde, dia);
  return esteMes > desde ? esteMes : conDia(sumarMeses(desde, 1), dia);
}

/** ¿El socio está atrasado? (venció y todavía no pagó) */
export function estaAtrasado(vencimiento: string | null | undefined): boolean {
  return !!vencimiento && vencimiento < hoyISO();
}

/**
 * Nuevo vencimiento al cobrarle una cuota a un socio.
 *
 * MODO ANIVERSARIO (default, el de gimnasio):
 *   - Al día → suma un mes A SU VENCIMIENTO, así no pierde los días que le
 *     quedaban pagos.
 *   - Vencido → cuenta desde HOY; no tiene sentido renovar desde una fecha
 *     vieja y que quede vencido igual.
 *
 * MODO DÍA FIJO (estudios que cobran "del 1 al 10"):
 *   - Al día → el mismo día, un mes después (vence el 10/09 → 10/10).
 *   - Vencido → la próxima vez que caiga ese día. Si venció el 10/08 y paga el
 *     27/08, queda al 10/09; si paga el 05/09, también al 10/09 (no se le
 *     regala un mes por pagar más tarde).
 */
export function nuevoVencimiento(
  vencimientoActual: string | null | undefined,
  cfg?: CobroConfig | null,
  meses = 1,
): string {
  const hoy = hoyISO();
  const alDia = !!vencimientoActual && vencimientoActual >= hoy;

  if (cfg?.cobro_modo === "dia_fijo") {
    const dia = Number(cfg.cobro_dia) || 10;
    if (alDia) return conDia(sumarMeses(vencimientoActual as string, meses), dia);
    return proximoDiaFijo(hoy, dia);
  }

  const base = alDia ? (vencimientoActual as string) : hoy;
  return sumarMeses(base, meses);
}

/** Recargo por pagar tarde. Devuelve 0 si no está configurado o si está al día. */
export function recargoDe(
  montoBase: number,
  cfg: CobroConfig | null | undefined,
  vencimiento: string | null | undefined,
): number {
  if (!cfg?.recargo_tipo || !cfg.recargo_valor) return 0;
  if (!estaAtrasado(vencimiento)) return 0;
  const v = Number(cfg.recargo_valor) || 0;
  if (v <= 0) return 0;
  const r = cfg.recargo_tipo === "porcentaje" ? (montoBase * v) / 100 : v;
  return Math.round(r);
}

/** "2026-09-10" → "10/09/2026" */
export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
