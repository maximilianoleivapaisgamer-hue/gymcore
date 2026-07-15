import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Pago por transferencia del abono (lado del dueño):
 *  GET  → datos para transferir (alias/CBU/titular/nota + WhatsApp de soporte)
 *         y la última solicitud pendiente del gimnasio, si hay.
 *  POST → registra el comprobante ({ plan, receiptUrl }). Queda 'pendiente'
 *         hasta que el super admin lo verifica (hasta 48hs).
 */
export const runtime = "nodejs";

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function meGym() {
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: "No autenticado.", status: 401 as const };
  const admin = adminClient();
  const { data: prof } = await admin.from("profiles").select("gym_id").eq("id", user.id).maybeSingle<{ gym_id: string }>();
  if (!prof?.gym_id) return { error: "Tu usuario no tiene un gimnasio asociado.", status: 400 as const };
  return { admin, gymId: prof.gym_id };
}

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  }
  const m = await meGym();
  if ("error" in m) return NextResponse.json({ ok: false, error: m.error }, { status: m.status });

  const [{ data: s }, { data: pending }, { data: planCfgs }] = await Promise.all([
    m.admin.from("platform_settings").select("transfer_alias, transfer_cbu, transfer_holder, transfer_note, support_whatsapp").eq("id", 1).maybeSingle(),
    m.admin.from("transfer_payments").select("id, plan, amount, status, created_at").eq("gym_id", m.gymId).eq("status", "pendiente").order("created_at", { ascending: false }).limit(1),
    m.admin.from("plan_configs").select("key, label, price").order("sort"),
  ]);

  return NextResponse.json({
    ok: true,
    datos: {
      alias: s?.transfer_alias || "",
      cbu: s?.transfer_cbu || "",
      titular: s?.transfer_holder || "",
      nota: s?.transfer_note || "",
      whatsapp: s?.support_whatsapp || "",
    },
    planes: planCfgs || [],
    pendiente: (pending && pending[0]) || null,
  });
}

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  }
  const m = await meGym();
  if ("error" in m) return NextResponse.json({ ok: false, error: m.error }, { status: m.status });

  let body: { plan?: string; receiptUrl?: string; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const plan = String(body.plan || "").trim();
  if (!["basico", "pro", "elite"].includes(plan)) {
    return NextResponse.json({ ok: false, error: "Plan inválido." }, { status: 400 });
  }
  const receiptUrl = typeof body.receiptUrl === "string" ? body.receiptUrl.trim() : "";
  if (!receiptUrl) {
    return NextResponse.json({ ok: false, error: "Subí el comprobante de la transferencia." }, { status: 400 });
  }

  // Precio del plan (para dejar registrado el monto esperado).
  const { data: pc } = await m.admin.from("plan_configs").select("price").eq("key", plan).maybeSingle<{ price: number }>();

  const { error } = await m.admin.from("transfer_payments").insert({
    gym_id: m.gymId,
    plan,
    amount: pc?.price ?? null,
    receipt_url: receiptUrl,
    note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
    status: "pendiente",
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
