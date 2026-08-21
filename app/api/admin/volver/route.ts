import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";

/**
 * Volver a tu cuenta de super admin después de haber entrado a la de un cliente
 * con /api/admin/entrar.
 *
 * Lee la cookie `tg_volver` (httpOnly, la puso el endpoint de entrada con tu
 * user id), verifica contra la base que ESE id siga siendo super_admin, y te
 * reinicia la sesión con un magic link. Después borra las dos cookies.
 *
 * Si algo no cierra, te manda a /acceso para que entres a mano: nunca deja una
 * sesión a medio camino.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { origin } = new URL(req.url);

  /** Salida de emergencia: cerrar sesión y a la pantalla de login. */
  const aMano = () => {
    const r = NextResponse.redirect(`${origin}/acceso`);
    r.cookies.delete("tg_viendo_como");
    r.cookies.delete("tg_volver");
    return r;
  };

  if (!url || !anon || !serviceKey) return aMano();

  const adminId = req.cookies.get("tg_volver")?.value || "";
  if (!adminId) return aMano();

  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // El id guardado tiene que seguir siendo super admin. Si lo degradaron
  // mientras tanto, no lo restauramos.
  const { data: prof } = await admin.from("profiles").select("role").eq("id", adminId).maybeSingle<{ role: string }>();
  if (prof?.role !== "super_admin") return aMano();

  const { data: u } = await admin.auth.admin.getUserById(adminId);
  const email = u.user?.email || "";
  if (!email) return aMano();

  const res = NextResponse.redirect(`${origin}/admin`);
  const sb = createServerClient(url, anon, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll(list: { name: string; value: string; options?: any }[]) { list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)); },
    },
  });

  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = link?.properties?.hashed_token;
  if (!hash) return aMano();
  const { error } = await sb.auth.verifyOtp({ token_hash: hash, type: "magiclink" });
  if (error) return aMano();

  res.cookies.delete("tg_viendo_como");
  res.cookies.delete("tg_volver");
  return res;
}
