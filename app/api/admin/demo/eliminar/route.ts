import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Elimina un gimnasio DEMO (solo super admin, y solo si is_demo = true).
 * Borra el gimnasio (los datos cascadean solos) y las cuentas de acceso
 * (dueño + socios demo).
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
  if (me?.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Solo el super admin puede borrar demos." }, { status: 403 });
  }

  let body: { gymId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const gymId = String(body.gymId || "").trim();
  if (!gymId) return NextResponse.json({ ok: false, error: "Falta gymId." }, { status: 400 });

  // Traer el gym y confirmar que es DEMO (nunca borramos un cliente real).
  const { data: gym } = await admin.from("gyms").select("id, owner_id, is_demo").eq("id", gymId).single<{ id: string; owner_id: string; is_demo: boolean }>();
  if (!gym) return NextResponse.json({ ok: false, error: "No existe esa demo." }, { status: 404 });
  if (!gym.is_demo) return NextResponse.json({ ok: false, error: "Ese gimnasio NO es una demo. No se borra desde acá." }, { status: 403 });

  // Juntar las cuentas de acceso (dueño + socios vinculados) antes de borrar.
  const { data: socios } = await admin.from("members").select("linked_user_id").eq("gym_id", gymId).not("linked_user_id", "is", null);
  const userIds = new Set<string>();
  if (gym.owner_id) userIds.add(gym.owner_id);
  (socios as { linked_user_id: string | null }[] | null)?.forEach((s) => { if (s.linked_user_id) userIds.add(s.linked_user_id); });

  // Borrar el gimnasio (cascadea members, rutinas, dietas, clases, caja, sedes…).
  const { error: delErr } = await admin.from("gyms").delete().eq("id", gymId);
  if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });

  // Borrar las cuentas de acceso.
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
