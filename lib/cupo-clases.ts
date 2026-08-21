/**
 * Cupo de clases del socio según su plan.
 *
 * ⚠️ La cuenta de acá es solo para MOSTRARLA en la app del socio ("te quedan 3
 * de 8"). Quien realmente frena la reserva es el trigger de la base
 * (supabase/migration_038_tope_clases_por_plan.sql). Si tocás una, tocá la otra:
 * tienen que dar el mismo resultado.
 *
 * El ciclo son los 30 días de la cuota de CADA socio, anclados a
 * members.membership_expiry. Si vence el 20/09, el ciclo va del 20/08 al 20/09.
 * Sin vencimiento cargado, se cae al mes calendario.
 */

/** Suma meses a una fecha "YYYY-MM-DD" recortando el día como hace Postgres
 *  (31/01 + 1 mes = 28/02, no 03/03). */
function sumarMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + n;
  const ay = Math.floor(total / 12);
  const am = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(ay, am, 0)).getUTCDate();
  const ad = Math.min(d, ultimoDia);
  return `${ay}-${String(am).padStart(2, "0")}-${String(ad).padStart(2, "0")}`;
}

/** Ciclo (ini, fin] que contiene a `fecha`. `ini` es exclusivo, `fin` inclusivo. */
export function cicloDe(fecha: string, vence: string | null | undefined): { ini: string; fin: string } {
  if (!vence) {
    // Mes calendario. `ini` es exclusivo, así que es el último día del mes
    // anterior — igual que `date_trunc('month', ...) - 1` en el trigger.
    const [y, m] = fecha.split("-").map(Number);
    const anterior = new Date(Date.UTC(y, m - 1, 0));   // día 0 = último del mes previo
    const ultimo = new Date(Date.UTC(y, m, 0));         // último día de este mes
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { ini: fmt(anterior), fin: fmt(ultimo) };
  }
  let fin = vence;
  let vueltas = 0;
  while (fin < fecha && vueltas < 600) { fin = sumarMeses(fin, 1); vueltas++; }
  while (sumarMeses(fin, -1) >= fecha && vueltas < 600) { fin = sumarMeses(fin, -1); vueltas++; }
  return { ini: sumarMeses(fin, -1), fin };
}

/** Tope del plan del socio dentro de los planes del gimnasio. null = ilimitado.
 *  Compara con trim/lower porque los nombres cargados a mano traen espacios. */
export function topeDelPlan(
  planes: { name: string; class_limit?: number | null }[] | null | undefined,
  planName: string | null | undefined,
): number | null {
  const buscado = String(planName || "").trim().toLowerCase();
  if (!buscado) return null;
  const p = (planes || []).find((x) => String(x.name || "").trim().toLowerCase() === buscado);
  const n = Number(p?.class_limit ?? 0);
  return n > 0 ? n : null;
}

/**
 * ¿El plan incluye esta actividad?
 *
 * ⚠️ Igual que el cupo, esto es para MOSTRARLO nomás. Quien frena de verdad es
 * el trigger (migration_039). Si tocás una, tocá la otra.
 */
export function claseIncluida(
  plan: { clases_modo?: "todas" | "excepto" | "solo"; clases_lista?: string[] } | null | undefined,
  nombreClase: string | null | undefined,
): boolean {
  const modo = plan?.clases_modo || "todas";
  const lista = plan?.clases_lista || [];
  if (modo === "todas" || lista.length === 0) return true;
  const clase = String(nombreClase || "").trim().toLowerCase();
  const esta = lista.some((x) => String(x || "").trim().toLowerCase() === clase);
  return modo === "solo" ? esta : !esta;
}

/** El plan del socio dentro de los planes del gimnasio (match con trim+lower). */
export function planDelSocio<T extends { name: string }>(
  planes: T[] | null | undefined,
  planName: string | null | undefined,
): T | null {
  const buscado = String(planName || "").trim().toLowerCase();
  if (!buscado) return null;
  return (planes || []).find((x) => String(x.name || "").trim().toLowerCase() === buscado) || null;
}

/** Actividades únicas del gimnasio (agrupa los horarios repetidos por nombre).
 *  DanzArte tiene 4 filas de "Zumba": acá aparece una sola vez. */
export function actividadesUnicas(clases: { name: string }[] | null | undefined): string[] {
  const vistas = new Map<string, string>();
  (clases || []).forEach((c) => {
    const nombre = String(c.name || "").trim();
    if (!nombre) return;
    const clave = nombre.toLowerCase();
    if (!vistas.has(clave)) vistas.set(clave, nombre);
  });
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, "es"));
}
