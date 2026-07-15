import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Gestión de gimnasios desde el Super Admin (solo super admin):
 *  - archivar / desarchivar: oculta o vuelve a mostrar el gimnasio en la lista
 *    de clientes (reversible, no borra nada).
 *  - eliminar: borra el gimnasio y sus cuentas de acceso (dueño + socios).
 *    Los datos (socios, rutinas, dietas, clases, caja, sedes) cascadean solos.
 *    Acción destructiva: el frontend pide confirmación.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

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
  if (me?.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Solo el super admin." }, { status: 403 });
  }

  let body: { gymId?: string; action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const gymId = String(body.gymId || "").trim();
  const action = String(body.action || "");
  if (!gymId) return NextResponse.json({ ok: false, error: "Falta gymId." }, { status: 400 });

  const { data: gym } = await admin.from("gyms").select("id, owner_id").eq("id", gymId).maybeSingle<{ id: string; owner_id: string }>();
  if (!gym) return NextResponse.json({ ok: false, error: "No existe ese gimnasio." }, { status: 404 });

  if (action === "archivar" || action === "desarchivar") {
    const { error } = await admin.from("gyms").update({ archived: action === "archivar" }).eq("id", gymId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, archived: action === "archivar" });
  }

  if (action === "eliminar") {
    // Juntar cuentas de acceso (dueño + socios vinculados) antes de borrar.
    const { data: socios } = await admin.from("members").select("linked_user_id").eq("gym_id", gymId).not("linked_user_id", "is", null);
    const userIds = new Set<string>();
    if (gym.owner_id) userIds.add(gym.owner_id);
    (socios as { linked_user_id: string | null }[] | null)?.forEach((s) => { if (s.linked_user_id) userIds.add(s.linked_user_id); });

    const { error: delErr } = await admin.from("gyms").delete().eq("id", gymId);
    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });

    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
    return NextResponse.json({ ok: true, deleted: true });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
