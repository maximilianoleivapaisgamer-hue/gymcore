/**
 * Permisos de empleados. El dueño crea empleados y les da acceso a las
 * secciones que quiera (entrenador, caja o a medida).
 *
 * Cada permiso es una sección del panel. El Dashboard (inicio) lo ven todos.
 */

export type StaffPerm = "socios" | "rutinas" | "dietas" | "clases" | "finanzas" | "control_acceso";

/** Secciones que se pueden habilitar, con su etiqueta y la ruta del panel. */
export const STAFF_PERMS: { key: StaffPerm; label: string; href: string }[] = [
  { key: "socios", label: "Socios", href: "/dashboard/socios" },
  { key: "rutinas", label: "Rutinas", href: "/dashboard/rutinas" },
  { key: "dietas", label: "Dietas", href: "/dashboard/dietas" },
  { key: "clases", label: "Clases", href: "/dashboard/clases" },
  { key: "finanzas", label: "Finanzas / Caja", href: "/dashboard/finanzas" },
  { key: "control_acceso", label: "Control de acceso", href: "/dashboard/control-acceso" },
];

/** Perfiles predefinidos para crear rápido. */
export const STAFF_PRESETS: { key: string; label: string; desc: string; perms: StaffPerm[] }[] = [
  { key: "entrenador", label: "Entrenador", desc: "Carga rutinas, dietas y ve socios y clases.", perms: ["socios", "rutinas", "dietas", "clases"] },
  { key: "caja", label: "Caja / Recepción", desc: "Maneja la caja, los socios y el control de acceso.", perms: ["socios", "finanzas", "control_acceso"] },
  { key: "personalizado", label: "Personalizado", desc: "Elegí vos qué secciones puede ver.", perms: [] },
];

/** ¿El empleado (por sus permisos) puede entrar a esta ruta del panel? */
export function staffCanAccess(pathname: string, perms: string[]): boolean {
  if (pathname === "/dashboard") return true; // el inicio lo ven todos
  const match = STAFF_PERMS.find((p) => pathname.startsWith(p.href));
  if (!match) return false; // secciones sin permiso definido (config, planes, equipo…) = solo dueño
  return perms.includes(match.key);
}
