/**
 * Multi-sede (sucursales).
 *
 * Un gimnasio puede tener varias sedes. La sede "activa" (la que el dueño o el
 * empleado está viendo en el panel) se guarda en localStorage, separada por
 * gimnasio, así cada gym recuerda su última sede elegida.
 *
 * Los socios/rutinas/dietas son compartidos por todo el gym. Lo que se filtra
 * por sede es la caja (finanzas), las clases y el control de acceso.
 */

export interface Sede {
  id: string;
  gym_id: string;
  name: string;
  address: string | null;
  created_at?: string;
}

/** Cuántas sedes permite cada plan. */
export const SEDE_LIMITS: Record<string, number> = {
  basico: 1,
  pro: 3,
  elite: Infinity,
};

/** Límite de sedes para un plan (default: 1 si el plan es desconocido/null). */
export function sedeLimitFor(plan: string | null | undefined): number {
  if (!plan) return 1;
  const key = plan.toLowerCase();
  return key in SEDE_LIMITS ? SEDE_LIMITS[key] : 1;
}

/** Texto lindo del límite para mostrar en la UI. */
export function sedeLimitLabel(plan: string | null | undefined): string {
  const n = sedeLimitFor(plan);
  return n === Infinity ? "ilimitadas" : String(n);
}

const KEY_PREFIX = "turnogym.sede.";
/** El último gimnasio que se vio en este navegador. */
const KEY_GYM = "turnogym.gym";
/** Evento que se dispara cuando cambia la sede activa (para recargar vistas). */
export const SEDE_EVENT = "turnogym:sede-changed";

function storageKey(gymId: string) {
  return KEY_PREFIX + gymId;
}

/**
 * Recordar de qué gimnasio es este navegador.
 *
 * Hace falta por un huevo y gallina: la sede activa se guarda POR gimnasio,
 * pero al abrir una pantalla todavía no sabemos cuál es el gimnasio — eso lo
 * dice el servidor. Sin este dato habría que ir a preguntarlo primero, que es
 * justo el viaje de más que estamos sacando.
 *
 * Es solo una pista para pedir la sede correcta de entrada: el servidor igual
 * valida que esa sede sea del gimnasio de quien pregunta.
 */
export function recordarGym(gymId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (gymId) window.localStorage.setItem(KEY_GYM, gymId);
    else window.localStorage.removeItem(KEY_GYM);
  } catch { /* modo incógnito */ }
}

export function ultimoGym(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(KEY_GYM); } catch { return null; }
}

/** La sede que hay que pedirle al servidor al abrir una pantalla, si se sabe. */
export function sedeParaPedir(): string | null {
  const gym = ultimoGym();
  return gym ? getActiveSedeId(gym) : null;
}

/** Sede activa guardada para este gym (o null si no hay). */
export function getActiveSedeId(gymId: string): string | null {
  if (typeof window === "undefined" || !gymId) return null;
  try {
    return window.localStorage.getItem(storageKey(gymId));
  } catch {
    return null;
  }
}

/** Guarda la sede activa para este gym y avisa a las vistas que están abiertas. */
export function setActiveSedeId(gymId: string, sedeId: string | null) {
  if (typeof window === "undefined" || !gymId) return;
  try {
    if (sedeId) window.localStorage.setItem(storageKey(gymId), sedeId);
    else window.localStorage.removeItem(storageKey(gymId));
  } catch {
    /* noop */
  }
  window.dispatchEvent(new CustomEvent(SEDE_EVENT, { detail: { gymId, sedeId } }));
}

/**
 * Resuelve qué sede usar: la guardada si sigue existiendo, si no la primera de
 * la lista. Si la guardada ya no existe, la corrige en localStorage.
 */
export function resolveActiveSede(gymId: string, sedes: Sede[]): string | null {
  if (!sedes.length) return null;
  const saved = getActiveSedeId(gymId);
  if (saved && sedes.some((s) => s.id === saved)) return saved;
  const first = sedes[0].id;
  setActiveSedeId(gymId, first);
  return first;
}
