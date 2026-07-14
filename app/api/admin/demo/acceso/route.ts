import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Devuelve los accesos de una demo (para poder pasárselos al cliente cuando
 * quieras): link de la web, login del dueño y login del socio. Solo super admin.
 * Reconstruye los datos desde la base/auth, no hace falta guardarlos.
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
    return NextResponse.json({ ok: false, error: "Solo el super admin." }, { status: 403 });
  }

  let body: { gymId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const gymId = String(body.gymId || "").trim();
  if (!gymId) return NextResponse.json({ ok: false, error: "Falta gymId." }, { status: 400 });

  const { data: gym } = await admin.from("gyms")
    .select("id, slug, name, owner_id, is_demo").eq("id", gymId)
    .single<{ id: string; slug: string; name: string; owner_id: string; is_demo: boolean }>();
  if (!gym || !gym.is_demo) return NextResponse.json({ ok: false, error: "No es una demo válida." }, { status: 404 });

  // Usuario del dueño = parte antes del @ de su email (la contraseña es igual).
  let ownerUser = "";
  try {
    const { data: ownerAuth } = await admin.auth.admin.getUserById(gym.owner_id);
    ownerUser = (ownerAuth?.user?.email || "").split("@")[0];
  } catch { /* noop */ }

  // Socio demo = el member vinculado a una cuenta (su DNI es usuario y contraseña).
  const { data: socioMem } = await admin.from("members")
    .select("full_name, dni").eq("gym_id", gymId).not("linked_user_id", "is", null)
    .limit(1).maybeSingle<{ full_name: string; dni: string | null }>();

  return NextResponse.json({
    ok: true,
    slug: gym.slug,
    name: gym.name,
    owner: { user: ownerUser, url: "/acceso" },
    socio: socioMem?.dni ? { name: socioMem.full_name, user: socioMem.dni, url: `/g/${gym.slug}` } : null,
  });
}
