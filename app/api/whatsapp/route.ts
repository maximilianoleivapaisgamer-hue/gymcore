import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { sendTemplate, waConfigured } from "@/lib/whatsapp";

/**
 * Configuración de recordatorios por WhatsApp del gimnasio (dueño logueado).
 *  GET  → { central, phoneId, enabled, daysBefore, gymName }
 *  POST { action: "save", phoneId, enabled, daysBefore } → guarda la config
 *  POST { action: "test", to } → manda una plantilla de prueba a ese número
 */
export const runtime = "nodejs";

async function meGym() {
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: "No autenticado.", status: 401 as const };
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: prof } = await admin.from("profiles").select("gym_id, role").eq("id", user.id).maybeSingle<{ gym_id: string | null; role: string }>();
  if (!prof?.gym_id) return { error: "Tu cuenta no tiene un gimnasio asociado.", status: 400 as const };
  return { admin, gymId: prof.gym_id };
}

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  const m = await meGym();
  if ("error" in m) return NextResponse.json({ ok: false, error: m.error }, { status: m.status });
  const { data: gym } = await m.admin.from("gyms").select("name, wa_phone_id, wa_reminders, wa_days_before").eq("id", m.gymId)
    .maybeSingle<{ name: string; wa_phone_id: string | null; wa_reminders: boolean; wa_days_before: number }>();
  return NextResponse.json({
    ok: true,
    central: waConfigured(),
    gymName: gym?.name || "",
    phoneId: gym?.wa_phone_id || "",
    enabled: !!gym?.wa_reminders,
    daysBefore: gym?.wa_days_before ?? 3,
  });
}

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  const m = await meGym();
  if ("error" in m) return NextResponse.json({ ok: false, error: m.error }, { status: m.status });

  let body: { action?: string; phoneId?: string; enabled?: boolean; daysBefore?: number; to?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  if (body.action === "save") {
    const patch = {
      wa_phone_id: String(body.phoneId || "").trim() || null,
      wa_reminders: !!body.enabled,
      wa_days_before: Math.max(0, Math.min(30, Number(body.daysBefore) || 3)),
    };
    const { error } = await m.admin.from("gyms").update(patch).eq("id", m.gymId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "test") {
    if (!waConfigured()) return NextResponse.json({ ok: false, error: "Falta el token/plantilla de WhatsApp en el servidor (lo carga el admin de turnogym)." }, { status: 503 });
    const { data: gym } = await m.admin.from("gyms").select("name, wa_phone_id").eq("id", m.gymId).maybeSingle<{ name: string; wa_phone_id: string | null }>();
    if (!gym?.wa_phone_id) return NextResponse.json({ ok: false, error: "Primero guardá el número de WhatsApp del gimnasio." }, { status: 400 });
    const to = String(body.to || "").trim();
    if (!to) return NextResponse.json({ ok: false, error: "Escribí un número para la prueba." }, { status: 400 });
    try {
      // Plantilla recordatorio_cuota: {{1}} nombre, {{2}} gimnasio, {{3}} vencimiento, {{4}} importe.
      await sendTemplate({ phoneId: gym.wa_phone_id, to, params: ["Prueba", gym.name || "tu gimnasio", "hoy", "$0"] });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
