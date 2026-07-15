import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Conversión de una DEMO en cliente real.
 *
 * promoteDemo() solo actúa si el gimnasio TODAVÍA es demo (is_demo=true), así
 * nunca puede borrar datos de un cliente real por error. Al convertir:
 *  - quita la marca de demo (is_demo=false, demo_suspended=false),
 *  - opcionalmente limpia los datos de ejemplo (socios, caja, peso, rutinas y
 *    dietas), manteniendo la web/marca, las clases y las sedes.
 */

async function cleanDemoData(admin: SupabaseClient, gymId: string): Promise<void> {
  // Cuentas de socio demo (para borrar sus logins).
  const { data: mem } = await admin.from("members")
    .select("linked_user_id").eq("gym_id", gymId).not("linked_user_id", "is", null);
  const socioUserIds = ((mem as { linked_user_id: string | null }[] | null) || [])
    .map((m) => m.linked_user_id).filter(Boolean) as string[];

  // Hijos primero, luego socios (best-effort: si algo falla, seguimos).
  const del = (table: string) => admin.from(table).delete().eq("gym_id", gymId).then(() => {}, () => {});
  await del("weight_logs");
  await del("attendances");
  await del("bookings");
  await del("cashflow_entries");
  await del("routines"); // cascada a routine_exercises
  await del("diets");    // cascada a diet_meals
  await del("members");

  for (const uid of socioUserIds) {
    await admin.auth.admin.deleteUser(uid).catch(() => {});
  }
}

/** Convierte una demo en cliente real. Devuelve { converted }. */
export async function promoteDemo(
  admin: SupabaseClient,
  gymId: string,
  clearSample = true
): Promise<{ converted: boolean }> {
  const { data: g } = await admin.from("gyms").select("is_demo").eq("id", gymId).maybeSingle<{ is_demo: boolean }>();
  if (!g?.is_demo) return { converted: false }; // ya es cliente real → no tocar NADA
  await admin.from("gyms").update({ is_demo: false, demo_suspended: false }).eq("id", gymId);
  if (clearSample) await cleanDemoData(admin, gymId);
  return { converted: true };
}
