import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { createPreapproval, mpConfigured } from "@/lib/mercadopago";

/**
 * Crea la suscripción de Mercado Pago para que el dueño cambie/active su plan.
 * Devuelve { init_point }: el link al que se lo redirige para autorizar la tarjeta.
 *
 * Requiere: MP_ACCESS_TOKEN y SUPABASE_SERVICE_ROLE_KEY en el servidor.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!mpConfigured()) {
    return NextResponse.json({ ok: false, error: "Los pagos con Mercado Pago todavía no están configurados. Escribinos para activar tu plan." }, { status: 503 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta configuración del servidor (SUPABASE_SERVICE_ROLE_KEY)." }, { status: 500 });
  }

  let body: { plan?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const plan = String(body.plan || "").trim();
  if (!["basico", "pro", "elite"].includes(plan)) {
    return NextResponse.json({ ok: false, error: "Plan inválido." }, { status: 400 });
  }

  // Usuario autenticado (dueño) + su gimnasio
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: profile } = await admin
    .from("profiles").select("gym_id, role").eq("id", user.id)
    .single<{ gym_id: string | null; role: string }>();
  if (!profile?.gym_id) {
    return NextResponse.json({ ok: false, error: "Tu cuenta no está asociada a un gimnasio." }, { status: 400 });
  }
  const gymId = profile.gym_id;

  // Precio del plan (desde la config editable)
  const { data: planCfg } = await admin
    .from("plan_configs").select("label, price").eq("key", plan)
    .maybeSingle<{ label: string; price: number }>();
  const amount = Number(planCfg?.price) || 0;
  if (amount <= 0) {
    return NextResponse.json({ ok: false, error: "Ese plan no tiene un precio configurado." }, { status: 400 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");

  let pre: { id: string; init_point: string };
  try {
    pre = await createPreapproval({
      reason: `turnogym - Plan ${planCfg?.label || plan}`,
      amount,
      payerEmail: user.email || "",
      backUrl: `${appUrl}/dashboard/mi-plan?mp=ok`,
      notificationUrl: `${appUrl}/api/pagos/webhook`,
      externalReference: `${gymId}|${plan}`,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }

  // Guardamos el id de la suscripción para reconciliar cuando llegue el webhook.
  await admin.from("subscriptions").update({ mp_preapproval_id: pre.id }).eq("gym_id", gymId);

  return NextResponse.json({ ok: true, init_point: pre.init_point });
}
