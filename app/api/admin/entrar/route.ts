import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Entrar a la cuenta de un cliente para ver su panel (o la app de uno de sus
 * socios) sin pedirle la contraseña. Solo el super admin.
 *
 *   /api/admin/entrar?gym=<id>&rol=owner  → entra como el dueño, va a /dashboard
 *   /api/admin/entrar?gym=<id>&rol=socio  → entra como un socio, va a /portal
 *
 * Cómo hace para entrar sin la clave: genera un magic link con la API de admin
 * de Supabase y lo canjea en el servidor (verifyOtp). Así funciona aunque el
 * dueño se haya cambiado la contraseña. Si eso falla, cae al método viejo de
 * las demos (clave == usuario), que sirve para las cuentas recién creadas.
 *
 * OJO: esto REEMPLAZA tu sesión de super admin por la del cliente. Por eso se
 * deja la cookie `tg_volver` (httpOnly, 8hs) con tu user id, para que el cartel
 * "Estás viendo como…" te pueda devolver con un click vía /api/admin/volver.
 *
 * Nunca deja entrar a la cuenta de otro super admin.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { searchParams, origin } = new URL(req.url);
  const fail = (msg: string) => NextResponse.redirect(`${origin}/admin?entrar=${encodeURIComponent(msg)}`);

  if (!url || !anon || !serviceKey) return fail("Falta configuración del servidor.");

  // 1) Solo el super admin, verificado contra la base (no contra el cliente).
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/acceso`);
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string }>();
  if (me?.role !== "super_admin") return fail("Solo el super admin puede hacer esto.");

  // 2) A qué cuenta entramos.
  const gymId = (searchParams.get("gym") || "").trim();
  const rol = searchParams.get("rol") === "socio" ? "socio" : "owner";
  if (!gymId) return fail("Falta el gimnasio.");

  const { data: gym } = await admin.from("gyms").select("id, name, owner_id").eq("id", gymId)
    .maybeSingle<{ id: string; name: string; owner_id: string }>();
  if (!gym) return fail("No existe ese gimnasio.");

  let targetId = "";
  let quien = "";
  if (rol === "owner") {
    targetId = gym.owner_id;
    quien = "el dueño";
  } else {
    const { data: mem } = await admin.from("members")
      .select("linked_user_id, full_name").eq("gym_id", gym.id).not("linked_user_id", "is", null)
      .order("created_at", { ascending: true }).limit(1)
      .maybeSingle<{ linked_user_id: string; full_name: string }>();
    if (!mem?.linked_user_id) {
      return fail(`${gym.name} todavía no tiene ningún socio con cuenta de acceso creada.`);
    }
    targetId = mem.linked_user_id;
    quien = mem.full_name || "un socio";
  }
  if (!targetId) return fail("Esa cuenta no tiene acceso configurado.");

  // Nunca suplantar a otro super admin.
  const { data: targetProf } = await admin.from("profiles").select("role").eq("id", targetId).maybeSingle<{ role: string }>();
  if (targetProf?.role === "super_admin") return fail("No se puede entrar a la cuenta de otro super admin.");

  const { data: u } = await admin.auth.admin.getUserById(targetId);
  const email = u.user?.email || "";
  if (!email) return fail("Esa cuenta no tiene usuario de acceso.");

  // 3) Iniciar la sesión del cliente y setear las cookies en la redirección.
  const dest = rol === "owner" ? "/dashboard" : "/portal";
  const res = NextResponse.redirect(`${origin}${dest}`);
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll(list: { name: string; value: string; options?: any }[]) { list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); },
    },
  });

  let entro = false;
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = link?.properties?.hashed_token;
  if (hash) {
    const { error } = await sb.auth.verifyOtp({ token_hash: hash, type: "magiclink" });
    entro = !error;
  }
  if (!entro) {
    // Respaldo: las cuentas que crea la plataforma arrancan con clave == usuario.
    const { error } = await sb.auth.signInWithPassword({ email, password: email.split("@")[0] });
    entro = !error;
  }
  if (!entro) return fail("No se pudo entrar a esa cuenta. Probá reiniciarle el acceso desde “Accesos”.");

  // Cartel "Estás viendo como…" (lo lee el navegador, no lleva nada sensible).
  const ochoHoras = 60 * 60 * 8;
  res.cookies.set("tg_viendo_como", encodeURIComponent(`${rol}|${gym.name}|${quien}`), {
    httpOnly: false, sameSite: "lax", path: "/", maxAge: ochoHoras,
  });
  // Para volver a tu cuenta con un click. httpOnly: no lo puede leer el JS de la
  // página. Al volver se re-chequea que ese id siga siendo super admin.
  res.cookies.set("tg_volver", user.id, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: ochoHoras,
  });
  return res;
}
