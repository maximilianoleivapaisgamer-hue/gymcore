/**
 * Secciones del panel que el dueño puede activar o desactivar desde
 * "Secciones" (menú → Tu negocio). En gyms.hidden_sections se guardan las
 * CLAVES de las secciones apagadas; lo que no está en esa lista, se muestra.
 *
 * Las secciones núcleo (Inicio, Socios, Mi plan, Mi cuenta, Super Admin) no
 * aparecen acá porque no se pueden apagar.
 */
export interface PanelSection {
  /** Clave estable que se guarda en gyms.hidden_sections. */
  key: string;
  label: string;
  hint: string;
}

export const TOGGLEABLE_SECTIONS: PanelSection[] = [
  { key: "rutinas", label: "Rutinas", hint: "Armar y asignar rutinas de entrenamiento." },
  { key: "dietas", label: "Dietas", hint: "Planes de comida y nutrición." },
  { key: "finanzas", label: "Finanzas", hint: "Ingresos, egresos y caja del gimnasio." },
  { key: "clases", label: "Clases y reservas", hint: "Agenda de clases y cupos para los socios." },
  { key: "equipo", label: "Equipo", hint: "Sumar profes o staff con permisos." },
  { key: "sedes", label: "Sucursales", hint: "Manejar más de una sede." },
  { key: "control-acceso", label: "Control de acceso", hint: "Ingreso de socios por QR / DNI." },
  { key: "planes", label: "Planes de socio", hint: "Los planes que les cobrás a tus socios." },
  { key: "pagina-publica", label: "Página pública", hint: "Tu web con la marca del gimnasio." },
  { key: "whatsapp", label: "Recordatorios WhatsApp", hint: "Avisos de cuota por WhatsApp." },
];

export const TOGGLEABLE_KEYS: string[] = TOGGLEABLE_SECTIONS.map((s) => s.key);

/**
 * Secciones que ve el SOCIO en su app (portal). El dueño puede ocultarlas para
 * sus clientes de forma independiente a su propio panel: podés seguir usando
 * Rutinas vos, pero que a los socios no les aparezca. Las claves coinciden con
 * las pestañas del portal ("rutina", "dieta", "clases"). Se guardan las claves
 * OCULTAS en gyms.hidden_member_sections.
 */
export const MEMBER_SECTIONS: PanelSection[] = [
  { key: "rutina", label: "Rutina", hint: "Que el socio vea su rutina en la app." },
  { key: "dieta", label: "Dieta", hint: "Que el socio vea su plan de comidas en la app." },
  { key: "clases", label: "Clases y reservas", hint: "Que el socio vea y reserve clases en la app." },
];

export const MEMBER_KEYS: string[] = MEMBER_SECTIONS.map((s) => s.key);

/** ¿La sección está activa para este gimnasio? (por defecto sí). */
export function sectionOn(hidden: string[] | null | undefined, key: string): boolean {
  return !(hidden || []).includes(key);
}
