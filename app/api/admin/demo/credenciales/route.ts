import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Cambia el USUARIO/CONTRASEÑA del panel del dueño de una DEMO (solo super admin,
 * solo is_demo). Mantiene la convención usuario = contraseña, y el dominio
 * @socios.gymcore.app (NO se cambia, rompería el login).
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }

  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") return NextResponse.json({ ok: false, error: "Solo el super admin." }, { status: 403 });

  let body: { gymId?: string; newUser?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const gymId = String(body.gymId || "").trim();
  if (!gymId) return NextResponse.json({ ok: false, error: "Falta gymId." }, { status: 400 });

  // Normalizar el usuario: solo minúsculas y números (para que sea fácil de dictar).
  const nuevo = String(body.newUser || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (nuevo.length < 4) return NextResponse.json({ ok: false, error: "El usuario debe tener al menos 4 letras/números (sin espacios ni símbolos)." }, { status: 400 });
  if (nuevo.length > 30) return NextResponse.json({ ok: false, error: "El usuario es demasiado largo." }, { status: 400 });

  // Verificar que sea una DEMO y obtener el dueño.
  const { data: gym } = await admin.from("gyms").select("id, owner_id, is_demo").eq("id", gymId).maybeSingle<{ id: string; owner_id: string; is_demo: boolean }>();
  if (!gym) return NextResponse.json({ ok: false, error: "No existe ese gimnasio." }, { status: 404 });
  if (!gym.is_demo) return NextResponse.json({ ok: false, error: "Solo se puede cambiar en demos." }, { status: 403 });
  if (!gym.owner_id) return NextResponse.json({ ok: false, error: "La demo no tiene dueño." }, { status: 400 });

  const email = `${nuevo}@socios.gymcore.app`;
  const { error } = await admin.auth.admin.updateUserById(gym.owner_id, {
    email, password: nuevo, email_confirm: true,
  });
  if (error) {
    const msg = /already|exists|registered|duplicate/i.test(error.message || "")
      ? "Ese usuario ya está en uso. Probá con otro."
      : error.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user: nuevo });
}
