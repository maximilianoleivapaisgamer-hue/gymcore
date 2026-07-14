import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Baja de un empleado (lo saca del equipo y elimina su cuenta).
 * Solo el dueño del gimnasio puede hacerlo.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }

  let body: { gymId?: string; userId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const gymId = String(body.gymId || "").trim();
  const userId = String(body.userId || "").trim();
  if (!gymId || !userId) return NextResponse.json({ ok: false, error: "Faltan datos." }, { status: 400 });

  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Verificar que quien llama es el dueño de ese gimnasio.
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const { data: me } = await admin.from("profiles").select("role, gym_id").eq("id", user.id)
    .single<{ role: string; gym_id: string | null }>();
  if (!(me?.role === "owner" || me?.role === "super_admin") || me?.gym_id !== gymId) {
    return NextResponse.json({ ok: false, error: "No tenés permiso." }, { status: 403 });
  }

  // Verificar que el empleado pertenece a ese gimnasio.
  const { data: emp } = await admin.from("profiles").select("role, gym_id").eq("id", userId)
    .single<{ role: string; gym_id: string | null }>();
  if (emp?.role !== "empleado" || emp?.gym_id !== gymId) {
    return NextResponse.json({ ok: false, error: "Ese empleado no es de tu gimnasio." }, { status: 400 });
  }

  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});

  return NextResponse.json({ ok: true });
}
