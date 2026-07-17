import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Gestión de super admins (solo super admin):
 *  - list:   devuelve los super admin actuales (con su email).
 *  - grant:  a la cuenta con ese email la hace super admin.
 *  - revoke: le saca el super admin a una cuenta (vuelve a "owner").
 * Nunca te podés sacar el super admin a vos mismo (para no quedarte afuera).
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  }

  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Solo el super admin." }, { status: 403 });
  }

  let body: { action?: string; email?: string; userId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const action = String(body.action || "");

  // Listar los super admin actuales (con email).
  async function listAdmins() {
    const { data } = await admin.rpc("admin_list_super_admins");
    return (data as { id: string; email: string; full_name: string | null }[] | null) || [];
  }

  if (action === "list") {
    return NextResponse.json({ ok: true, admins: await listAdmins() });
  }

  if (action === "grant") {
    const email = String(body.email || "").trim();
    if (!email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Escribí un email válido." }, { status: 400 });
    }
    const { data: foundId } = await admin.rpc("admin_find_user_id_by_email", { p_email: email });
    if (!foundId) {
      return NextResponse.json({ ok: false, error: "No hay ninguna cuenta con ese email. La persona tiene que registrarse primero." }, { status: 404 });
    }
    const { error } = await admin.from("profiles")
      .update({ role: "super_admin", gym_id: null })
      .eq("id", foundId as string);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, admins: await listAdmins() });
  }

  if (action === "revoke") {
    const userId = String(body.userId || "").trim();
    if (!userId) return NextResponse.json({ ok: false, error: "Falta el usuario." }, { status: 400 });
    if (userId === user.id) {
      return NextResponse.json({ ok: false, error: "No te podés sacar el super admin a vos mismo." }, { status: 400 });
    }
    const { error } = await admin.from("profiles").update({ role: "owner" }).eq("id", userId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, admins: await listAdmins() });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
