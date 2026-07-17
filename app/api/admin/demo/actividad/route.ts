import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Actividad de una DEMO (solo super admin): cuántas veces el PROSPECTO abrió la
 * web, entró al panel del dueño y a la app del socio, con la última fecha de cada
 * uno. Excluye tus propios eventos (is_owner = true).
 */
export const runtime = "nodejs";

type Metric = { count: number; last: string | null };

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });

  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") return NextResponse.json({ ok: false, error: "Solo el super admin." }, { status: 403 });

  let body: { gymId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const gymId = String(body.gymId || "").trim();
  if (!gymId) return NextResponse.json({ ok: false, error: "Falta gymId." }, { status: 400 });

  const { data } = await admin.from("demo_visits")
    .select("kind, created_at")
    .eq("gym_id", gymId).eq("is_owner", false)
    .order("created_at", { ascending: false }).limit(3000);

  const agg: Record<string, Metric> = { web: { count: 0, last: null }, panel: { count: 0, last: null }, socio: { count: 0, last: null } };
  for (const r of (data as { kind: string; created_at: string }[] | null) || []) {
    const a = agg[r.kind];
    if (a) { a.count++; if (!a.last) a.last = r.created_at; }
  }

  return NextResponse.json({ ok: true, actividad: agg });
}
