/**
 * A qué clase corresponde cada entrada del control de acceso.
 *
 * ── El problema ─────────────────────────────────────────────────────────
 *
 * `attendances` guarda QUE la persona entró, no a qué clase entró. Pero
 * guarda la HORA, y las clases tienen día y horario. Si a esa hora hay una
 * sola clase, no hay nada que adivinar.
 *
 * Medido sobre los 542 ingresos de un mes de DanzArte: el 95,2% cae en una
 * sola clase y NINGUNO cayó en dos.
 *
 * ⚠️ Si a esa hora hay DOS clases, se descarta en vez de adivinar. Puede
 * pasar en un gimnasio con horarios superpuestos, y pagarle la clase a la
 * profe equivocada es peor que no contarla.
 *
 * ⚠️ Esto vive acá y no en cada pantalla porque lo usan las comisiones (que
 * reparten plata), el panel de clases y la ficha del socio. Si cada una
 * dedujera distinto, la dueña vería tres números para el mismo día.
 */

/** Cuánto antes y después del horario se acepta una entrada como "vino a esa clase". */
export const ANTES_MIN = 40;
export const DESPUES_MIN = 20;

const DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

export interface ClaseConHorario {
  id: string;
  weekdays: string[] | null;
  start_time: string | null;
}

export interface Ingreso {
  member_id: string;
  entered_at: string;
}

export interface Ubicacion {
  /** El día en Argentina, "YYYY-MM-DD". */
  fecha: string;
  /** La hora en Argentina, "HH:MM". */
  hora: string;
  /** La clase, si hay una sola candidata. */
  class_id: string | null;
  /** Hubo más de una clase a esa hora: no se puede saber a cuál entró. */
  ambiguo: boolean;
}

/**
 * Ubica UNA entrada: qué día, qué hora y a qué clase corresponde.
 *
 * La hora se pasa a la de Argentina antes de comparar, porque los horarios de
 * las clases están cargados en hora de acá y `entered_at` viene en UTC.
 */
export function ubicarEntrada(enteredAt: string, clases: ClaseConHorario[]): Ubicacion {
  const local = new Date(new Date(enteredAt).toLocaleString("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
  }));
  const fecha = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  const hora = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
  const dia = DIAS[local.getDay()];
  const minutos = local.getHours() * 60 + local.getMinutes();

  const candidatas = clases.filter((c) => {
    if (!c.start_time || !(c.weekdays || []).length) return false;
    if (!(c.weekdays || []).includes(dia)) return false;
    const [h, m] = String(c.start_time).slice(0, 5).split(":").map(Number);
    const arranca = h * 60 + m;
    return minutos >= arranca - ANTES_MIN && minutos <= arranca + DESPUES_MIN;
  });

  return {
    fecha,
    hora,
    class_id: candidatas.length === 1 ? candidatas[0].id : null,
    ambiguo: candidatas.length > 1,
  };
}

/**
 * Las entradas que se pueden atribuir a una clase, como claves
 * "socio|clase|fecha" para poder unirlas con las reservas sin repetir.
 */
export function asistenciasDeducidas(ingresos: Ingreso[], clases: ClaseConHorario[]): Set<string> {
  const salida = new Set<string>();
  for (const i of ingresos) {
    const u = ubicarEntrada(i.entered_at, clases);
    if (!u.class_id) continue;
    salida.add(`${i.member_id}|${u.class_id}|${u.fecha}`);
  }
  return salida;
}

/** El día de hoy en Argentina, "YYYY-MM-DD". `toISOString()` da UTC y después
 *  de las 21 de acá eso ya es mañana. */
export function hoyEnArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
