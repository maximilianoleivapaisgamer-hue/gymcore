import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

/**
 * Auto-login a una demo SIN clave (para vender): mete al prospecto directo al
 * panel del dueño o a la app del socio. La sesión se inicia en el servidor y se
 * setea la cookie en la redirección. Solo funciona con gimnasios is_demo.
 *
 * Uso:
 *   /demo/entrar?rol=owner            → usa la demo pública configurada
 *   /demo/entrar?rol=socio
 *   /demo/entrar?slug=<slug>&rol=owner  → una demo puntual
 *
 * Invariante que lo hace posible: las cuentas demo se crean con la contraseña
 * igual a la parte local del email (usuario), así que no hace falta pedirla.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { searchParams, origin } = new URL(req.url);
  const fail = (msg: string) => NextResponse.redirect(`${origin}/acceso?demo=${encodeURIComponent(msg)}`);

  if (!url || !anon || !serviceKey) return fail("La demo no está disponible ahora.");

  const rol = searchParams.get("rol") === "socio" ? "socio" : "owner";
  let slug = (searchParams.get("slug") || "").trim();

  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Sin slug explícito, usamos la demo pública configurada.
  if (!slug) {
    const { data } = await admin.from("app_config").select("value").eq("key", "public_demo_slug").maybeSingle<{ value: string }>();
    slug = (data?.value || "").trim();
  }
  if (!slug) return fail("Todavía no hay una demo pública configurada.");

  const { data: gym } = await admin.from("gyms")
    .select("id, owner_id, is_demo, demo_suspended").eq("slug", slug)
    .maybeSingle<{ id: string; owner_id: string; is_demo: boolean; demo_suspended: boolean | null }>();
  if (!gym || !gym.is_demo) return fail("Esa demo no existe.");
  if (gym.demo_suspended) return fail("La demo está pausada por ahora.");

  // Cuenta a la que entramos según el rol.
  let email = "";
  if (rol === "owner") {
    const { data: u } = await admin.auth.admin.getUserById(gym.owner_id);
    email = u.user?.email || "";
  } else {
    const { data: mem } = await admin.from("members")
      .select("linked_user_id").eq("gym_id", gym.id).not("linked_user_id", "is", null)
      .order("created_at", { ascending: true }).limit(1).maybeSingle<{ linked_user_id: string }>();
    if (mem?.linked_user_id) {
      const { data: u } = await admin.auth.admin.getUserById(mem.linked_user_id);
      email = u.user?.email || "";
    }
  }
  if (!email) return fail("No se pudo abrir la demo.");
  const password = email.split("@")[0]; // clave == usuario (parte local) en las cuentas demo

  // Redirección con la sesión ya seteada en la cookie.
  const dest = rol === "owner" ? "/dashboard" : "/portal";
  const res = NextResponse.redirect(`${origin}${dest}`);
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll(list) { list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail("No se pudo entrar a la demo.");
  return res;
}
