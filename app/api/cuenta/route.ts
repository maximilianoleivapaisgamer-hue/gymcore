import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * "Mi cuenta" del dueño (logueado): cambiar su usuario de acceso y su contraseña.
 * Los accesos de estas cuentas usan un email sintético usuario@socios.gymcore.app
 * (el "usuario" es la parte antes de la @). Cambiar el usuario = cambiar ese email.
 *
 *  GET  → { email, username, isSynthetic }
 *  POST { action: "usuario", newUser } → cambia el usuario de acceso
 *  POST { action: "clave", newPass }   → cambia la contraseña
 */
export const runtime = "nodejs";
const DOMAIN = "socios.gymcore.app";

function adminClient() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const email = user.email || "";
  const isSynthetic = email.endsWith(`@${DOMAIN}`);
  return NextResponse.json({ ok: true, email, username: isSynthetic ? email.split("@")[0] : "", isSynthetic });
}

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  let body: { action?: string; newUser?: string; newPass?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const admin = adminClient();

  if (body.action === "usuario") {
    if (!(user.email || "").endsWith(`@${DOMAIN}`)) {
      return NextResponse.json({ ok: false, error: "Tu cuenta usa un email real; cambiá el usuario desde tu email." }, { status: 400 });
    }
    const nuevo = String(body.newUser || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (nuevo.length < 4) return NextResponse.json({ ok: false, error: "El usuario debe tener al menos 4 letras o números (sin espacios ni símbolos)." }, { status: 400 });
    const nuevoEmail = `${nuevo}@${DOMAIN}`;
    // ¿Ya lo usa otra cuenta?
    const { data: existe } = await admin.rpc("admin_find_user_id_by_email", { p_email: nuevoEmail });
    if (existe && existe !== user.id) return NextResponse.json({ ok: false, error: "Ese usuario ya está en uso. Probá otro." }, { status: 400 });
    const { error } = await admin.auth.admin.updateUserById(user.id, { email: nuevoEmail, email_confirm: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, username: nuevo });
  }

  if (body.action === "clave") {
    const pass = String(body.newPass || "");
    if (pass.length < 6) return NextResponse.json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: pass });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
