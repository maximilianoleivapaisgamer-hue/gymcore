import { createClient as createServer } from "@/lib/supabase-server";
import type { Sede } from "@/lib/sede";

/**
 * Lo que comparten las pantallas del panel para cargar de UNA sola vez.
 *
 * ── Por qué existe esto ──────────────────────────────────────────────────
 *
 * El panel pedía sus datos desde el navegador, y cada pantalla encadenaba
 * CINCO idas y vueltas esperando una a la otra:
 *
 *     sesión → perfil → sedes → gimnasio → (socios, clases, reservas)
 *
 * Cada eslabón tiene que terminar antes de que arranque el siguiente, así que
 * el dueño esperaba cinco viajes completos antes de ver nada. Y esos viajes
 * salen de Argentina hasta Canadá, que es donde vive la base: con una conexión
 * de gimnasio, cada uno se siente.
 *
 * Ahora el navegador hace UN pedido. El encadenamiento sigue existiendo, pero
 * pasa acá adentro, entre el servidor y la base, que están los dos en la nube y
 * se hablan en milisegundos.
 *
 * ── Sobre el aislamiento ─────────────────────────────────────────────────
 *
 * Todas las consultas filtran por `gym_id` a mano, aunque RLS ya lo haría.
 * Esa es la regla del proyecto: RLS es la red de seguridad, no el único
 * control. Varias de las consultas que se mudaron acá NO lo hacían.
 */

export interface Perfil {
  id: string;
  full_name: string | null;
  role: string;
  gym_id: string | null;
  permissions: string[] | null;
}

export interface Contexto {
  perfil: Perfil;
  sedes: Sede[];
  /** La sucursal que se está mirando, ya validada contra las del gimnasio. */
  sedeId: string | null;
  sb: ReturnType<typeof createServer>;
}

export type Fallo = { error: string; status: 401 | 403 | 500 };

/**
 * Quién pide, de qué gimnasio y qué sucursal está mirando.
 *
 * `sedePedida` viene del navegador (la tiene guardada en localStorage). Se
 * valida contra las sedes del gimnasio antes de usarla: si llegara una de otro
 * negocio, se ignora y se cae a la primera.
 */
export async function contexto(sedePedida?: string | null): Promise<Contexto | Fallo> {
  const sb = createServer();

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "No autenticado.", status: 401 };

  const { data: perfil } = await sb
    .from("profiles").select("id, full_name, role, gym_id, permissions").eq("id", user.id)
    .maybeSingle<Perfil>();
  if (!perfil) return { error: "Tu cuenta no tiene perfil.", status: 403 };
  if (!perfil.gym_id) {
    // Puede pasar con una cuenta a medio crear: devolvemos el perfil igual para
    // que la pantalla muestre su estado vacío en vez de quedarse cargando.
    return { perfil, sedes: [], sedeId: null, sb };
  }

  const { data: sedeList } = await sb
    .from("sedes").select("id, gym_id, name, address, created_at")
    .eq("gym_id", perfil.gym_id).order("created_at", { ascending: true });
  const sedes = (sedeList as Sede[]) || [];

  const pedida = String(sedePedida || "").trim();
  const sedeId = sedes.length === 0
    ? null
    : (pedida && sedes.some((s) => s.id === pedida) ? pedida : sedes[0].id);

  return { perfil, sedes, sedeId, sb };
}

export const esFallo = (c: Contexto | Fallo): c is Fallo => "error" in c;
