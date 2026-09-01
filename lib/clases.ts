/**
 * Días y horarios de las clases, en un solo lugar.
 *
 * Lo usan el panel de Clases y la web pública, para que "Lun/Mié/Vie · 08:30"
 * se escriba igual en los dos lados.
 */

export const DAYS = [
  { code: "lun", label: "Lun", js: 1 },
  { code: "mar", label: "Mar", js: 2 },
  { code: "mie", label: "Mié", js: 3 },
  { code: "jue", label: "Jue", js: 4 },
  { code: "vie", label: "Vie", js: 5 },
  { code: "sab", label: "Sáb", js: 6 },
  { code: "dom", label: "Dom", js: 0 },
];

/** ["lun","mie","vie"] → "Lun/Mié/Vie" */
export function dayLabels(codes: string[] | null | undefined): string {
  return (codes || [])
    .map((code) => DAYS.find((d) => d.code === code)?.label)
    .filter(Boolean)
    .join("/");
}

/** "08:30:00" → "08:30" */
export function fmtTime(t: string | null | undefined): string {
  return t ? String(t).slice(0, 5) : "";
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** Día de la semana de una fecha, en nuestro código: "lun", "mar", … */
export function codigoDelDia(d: Date = new Date()): string {
  return DAYS.find((x) => x.js === d.getDay())?.code || "lun";
}

/**
 * Próxima fecha que caiga en ese día de la semana, contando hoy.
 *
 * El portal muestra las clases por día ("Mar"), pero las reservas se guardan
 * con fecha. Un martes a la mañana, "mar" es hoy; un miércoles, es dentro de
 * seis días. Todas las clases de una misma solapa comparten esta fecha.
 */
export function proximaFechaDe(code: string, desde: Date = new Date()): string | null {
  const js = DAYS.find((d) => d.code === code)?.js;
  if (js === undefined) return null;
  for (let i = 0; i < 7; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
    if (d.getDay() === js) return iso(d);
  }
  return null;
}

/** "2026-09-01" → "hoy · martes 1 de septiembre" (o "mañana", o el día solo). */
export function fechaLarga(fecha: string, hoy: Date = new Date()): string {
  const d = new Date(fecha + "T00:00:00");
  const largo = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  if (fecha === iso(hoy)) return `hoy · ${largo}`;
  if (fecha === iso(manana)) return `mañana · ${largo}`;
  return largo;
}

/** Fila de la tabla `classes` (lo mínimo para mostrarla). */
export interface ClaseFila {
  name: string;
  weekdays: string[] | null;
  start_time: string | null;
  capacity: number | null;
}

/** Para ordenar la grilla: primero por el día más temprano de la semana, y
 *  dentro del día por hora. Lunes antes que sábado, 08:30 antes que 19:00. */
function orden(c: ClaseFila): string {
  const dias = (c.weekdays || [])
    .map((code) => DAYS.findIndex((d) => d.code === code))
    .filter((i) => i >= 0);
  const primerDia = dias.length ? Math.min(...dias) : 9;
  return `${primerDia}-${fmtTime(c.start_time) || "99:99"}`;
}

/**
 * Convierte las clases del panel al formato que muestra la web pública.
 *
 * Sirve para que el dueño no tenga que cargar la grilla dos veces: si prende
 * "sincronizar", la web lee estas mismas clases y siempre está al día.
 */
export function clasesALanding(
  filas: ClaseFila[] | null | undefined,
): { nombre: string; dias: string; horario: string; cupo?: number }[] {
  return (filas || [])
    .filter((c) => String(c.name || "").trim())
    .slice()
    .sort((a, b) => orden(a).localeCompare(orden(b)))
    .map((c) => ({
      nombre: String(c.name).trim(),
      dias: dayLabels(c.weekdays),
      horario: fmtTime(c.start_time),
      cupo: c.capacity != null ? Number(c.capacity) : undefined,
    }));
}
