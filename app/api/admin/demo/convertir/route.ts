import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { promoteDemo } from "@/lib/demo-convert";

/**
 * Convierte una DEMO en cliente real (acción asistida del super admin).
 * Quita la marca de demo, opcionalmente limpia los datos de ejemplo (según el
 * ajuste de Cobros) y deja una suscripción con el plan/estado elegidos.
 * Solo actúa sobre gimnasios is_demo=true.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const PLANS = ["basico", "pro", "elite"];
const STATES = ["trial", "active"];

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

  let body: { gymId?: string; plan?: string; status?: string; days?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const gymId = String(body.gymId || "").trim();
  if (!gymId) return NextResponse.json({ ok: false, error: "Falta gymId." }, { status: 400 });

  const plan = PLANS.includes(String(body.plan)) ? String(body.plan) : "basico";
  const status = STATES.includes(String(body.status)) ? String(body.status) : "trial";
  const days = Number.isFinite(body.days) ? Math.max(0, Math.min(60, Number(body.days))) : 7;

  // Ajuste global: ¿se limpian los datos de ejemplo al convertir?
  const { data: st } = await admin.from("platform_settings").select("convert_clear_sample").eq("id", 1).maybeSingle<{ convert_clear_sample: boolean }>();

  const res = await promoteDemo(admin, gymId, st?.convert_clear_sample ?? true);
  if (!res.converted) return NextResponse.json({ ok: false, error: "Ese gimnasio no es una demo (o ya es cliente)." }, { status: 400 });

  // Dejamos la suscripción según lo elegido.
  const now = new Date();
  const end = new Date(now); end.setDate(end.getDate() + (status === "trial" ? days : 30));
  const row: Record<string, unknown> = {
    gym_id: gymId,
    plan,
    status,
    trial_ends_at: status === "trial" ? end.toISOString() : null,
    current_period_end: status === "active" ? end.toISOString() : null,
    payment_method: null,
  };
  const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "gym_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, plan, status });
}
