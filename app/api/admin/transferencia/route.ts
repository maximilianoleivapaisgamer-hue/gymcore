import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { promoteDemo } from "@/lib/demo-convert";

/**
 * Verificación de transferencias (solo super admin):
 *  GET  → lista de transferencias pendientes (con nombre del gimnasio).
 *  POST → { id, action: 'aprobar' | 'rechazar' }.
 *         Al aprobar: activa la suscripción (plan del comprobante, método
 *         'transferencia', +1 mes) y convierte la demo en cliente si hacía falta.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

async function guard() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.", status: 500 as const };
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: "No autenticado.", status: 401 as const };
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") return { error: "Solo el super admin.", status: 403 as const };
  return { admin };
}

function nextMonthIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  const { data: rows } = await g.admin
    .from("transfer_payments")
    .select("id, gym_id, plan, amount, receipt_url, note, status, created_at")
    .eq("status", "pendiente")
    .order("created_at", { ascending: false });

  const list = rows || [];
  const gymIds = Array.from(new Set(list.map((r) => r.gym_id)));
  let names: Record<string, string> = {};
  if (gymIds.length) {
    const { data: gyms } = await g.admin.from("gyms").select("id, name, slug").in("id", gymIds);
    (gyms || []).forEach((gy: { id: string; name: string; slug: string }) => { names[gy.id] = gy.name; });
  }
  return NextResponse.json({ ok: true, pendientes: list.map((r) => ({ ...r, gym_name: names[r.gym_id] || "—" })) });
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  let body: { id?: string; action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const id = String(body.id || "").trim();
  const action = String(body.action || "");
  if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });

  const { data: tp } = await g.admin.from("transfer_payments").select("*").eq("id", id).maybeSingle<{
    id: string; gym_id: string; plan: string; status: string;
  }>();
  if (!tp) return NextResponse.json({ ok: false, error: "No se encontró la transferencia." }, { status: 404 });
  if (tp.status !== "pendiente") return NextResponse.json({ ok: false, error: "Esta transferencia ya fue revisada." }, { status: 400 });

  if (action === "rechazar") {
    await g.admin.from("transfer_payments").update({ status: "rechazado", reviewed_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, status: "rechazado" });
  }

  if (action === "aprobar") {
    // Si el gimnasio todavía era demo, lo convertimos (respetando el ajuste).
    const { data: st } = await g.admin.from("platform_settings").select("convert_clear_sample").eq("id", 1).maybeSingle<{ convert_clear_sample: boolean }>();
    try { await promoteDemo(g.admin, tp.gym_id, st?.convert_clear_sample ?? true); } catch { /* seguimos igual */ }

    await g.admin.from("subscriptions").upsert({
      gym_id: tp.gym_id,
      plan: tp.plan,
      status: "active",
      payment_method: "transferencia",
      current_period_end: nextMonthIso(),
    }, { onConflict: "gym_id" });

    await g.admin.from("transfer_payments").update({ status: "aprobado", reviewed_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, status: "aprobado" });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
