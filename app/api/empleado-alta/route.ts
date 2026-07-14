import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Alta de un empleado por parte del dueño.
 * Crea la cuenta (email + contraseña), la vincula al gimnasio y le asigna los
 * permisos (qué secciones del panel puede ver).
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el servidor.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }

  let body: { gymId?: string; fullName?: string; email?: string; password?: string; permissions?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const gymId = String(body.gymId || "").trim();
  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];

  if (!gymId || !fullName || !email || !password) {
    return NextResponse.json({ ok: false, error: "Completá nombre, email y contraseña." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  }

  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Verificar que quien llama es el dueño (o admin) de ESE gimnasio.
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const { data: me } = await admin.from("profiles").select("role, gym_id").eq("id", user.id)
    .single<{ role: string; gym_id: string | null }>();
  const isOwner = me?.role === "owner" || me?.role === "super_admin";
  if (!isOwner || me?.gym_id !== gymId) {
    return NextResponse.json({ ok: false, error: "No tenés permiso para dar de alta empleados en este gimnasio." }, { status: 403 });
  }

  // Crear la cuenta del empleado.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: "empleado", full_name: fullName },
  });
  if (createErr) {
    const already = /already|registered|exists|duplicate/i.test(createErr.message || "");
    return NextResponse.json({ ok: false, error: already ? "Ese email ya tiene una cuenta." : createErr.message }, { status: 400 });
  }
  const userId = created?.user?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "No se pudo crear la cuenta." }, { status: 400 });

  // Vincular al gimnasio + rol + permisos (el trigger ya creó el profile; lo ajustamos).
  await admin.from("profiles").upsert(
    { id: userId, role: "empleado", gym_id: gymId, full_name: fullName, permissions },
    { onConflict: "id" }
  );

  return NextResponse.json({ ok: true, userId });
}
