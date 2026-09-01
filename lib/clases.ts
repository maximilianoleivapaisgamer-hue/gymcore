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

/**
 * La primera letra de una clase, para el recuadro cuando no tiene foto.
 *
 * Se usa cuando el estudio cargó fotos en algunas clases y en otras no: en vez
 * de un cuadrado vacío, va la inicial en el color de la clase.
 */
export function inicialDe(nombre: string | null | undefined): string {
  return String(nombre || "").trim().charAt(0).toUpperCase() || "?";
}

/** "08:30:00" → "08:30" */
export function fmtTime(t: string | null | undefined): string {
  return t ? String(t).slice(0, 5) : "";
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** Hoy en formato "2026-09-01". */
export function hoyIso(desde: Date = new Date()): string { return iso(desde); }

/** Corre una fecha N días (sin tocar la original). */
export function sumarDias(d: Date, dias: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
}

/**
 * El lunes de la semana en la que cae esa fecha.
 *
 * La semana arranca en lunes y cierra en domingo, como la grilla de clases.
 */
export function lunesDe(d: Date = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return sumarDias(x, -((x.getDay() + 6) % 7));
}

/**
 * Qué fecha le toca a un día dentro de una semana concreta.
 *
 * El socio elige "Mié" y una semana; la reserva se guarda con esta fecha. DAYS
 * va de lunes a domingo, así que la posición en la lista es el desplazamiento
 * desde el lunes.
 */
export function fechaDeDia(lunes: Date, code: string): string | null {
  const i = DAYS.findIndex((d) => d.code === code);
  return i < 0 ? null : iso(sumarDias(lunes, i));
}

/** "1 al 7 de septiembre" · "29 de septiembre al 5 de octubre" */
export function rangoSemana(lunes: Date): string {
  const domingo = sumarDias(lunes, 6);
  const mes = (d: Date) => d.toLocaleDateString("es-AR", { month: "long" });
  return lunes.getMonth() === domingo.getMonth()
    ? `${lunes.getDate()} al ${domingo.getDate()} de ${mes(domingo)}`
    : `${lunes.getDate()} de ${mes(lunes)} al ${domingo.getDate()} de ${mes(domingo)}`;
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
