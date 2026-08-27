/** Fechas de cuota. Se usa en Finanzas, en la ficha del socio y en el cupo de
 *  clases, así todos calculan igual. */

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

/**
 * Nuevo vencimiento al cobrarle una cuota a un socio.
 *
 * - Si todavía está al día, suma un mes A PARTIR DE SU VENCIMIENTO, así no
 *   pierde los días que le quedaban por pagar antes.
 * - Si ya venció (o nunca tuvo fecha), arranca de HOY: no tiene sentido
 *   renovarle desde una fecha vieja y que quede vencido igual.
 */
export function nuevoVencimiento(vencimientoActual: string | null | undefined, meses = 1): string {
  const hoy = hoyISO();
  const base = vencimientoActual && vencimientoActual > hoy ? vencimientoActual : hoy;
  return sumarMeses(base, meses);
}

/** "2026-09-10" → "10/09/2026" */
export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
