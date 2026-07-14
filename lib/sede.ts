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
/** Evento que se dispara cuando cambia la sede activa (para recargar vistas). */
export const SEDE_EVENT = "turnogym:sede-changed";

function storageKey(gymId: string) {
  return KEY_PREFIX + gymId;
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
