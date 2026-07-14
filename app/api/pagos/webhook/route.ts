import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { getPreapproval, getPayment } from "@/lib/mercadopago";

/**
 * Webhook de Mercado Pago. MP nos avisa cuando cambia una suscripción o llega
 * un pago; acá actualizamos el plan/estado del gimnasio.
 *
 * Configurá esta URL en Mercado Pago como notification_url
 * (ya se envía automáticamente al crear la suscripción):
 *   https://TU-DOMINIO/api/pagos/webhook
 *
 * Requiere MP_ACCESS_TOKEN y SUPABASE_SERVICE_ROLE_KEY.
 */
export const runtime = "nodejs";

function admin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function nextMonthIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/** Aplica el estado de una suscripción (preapproval) al gimnasio. */
async function applyPreapproval(pre: any) {
  const ref: string = pre?.external_reference || "";
  const [gymId, plan] = ref.split("|");
  if (!gymId) return;

  const status: string = pre?.status || "";
  const patch: Record<string, unknown> = { mp_preapproval_id: pre?.id ?? null };

  if (status === "authorized") {
    // Suscripción activa: aplicamos el plan pagado y extendemos el período.
    if (plan) patch.plan = plan;
    patch.status = "active";
    patch.current_period_end = nextMonthIso();
  } else if (status === "paused") {
    patch.status = "past_due";
  } else if (status === "cancelled") {
    patch.status = "canceled";
  } else {
    return; // pending u otros: no tocamos nada todavía
  }

  await admin().from("subscriptions").update(patch).eq("gym_id", gymId);
}

export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  let type = q.get("type") || q.get("topic") || "";
  let id = q.get("data.id") || q.get("id") || "";
  try {
    const body = await req.json();
    if (body) {
      type = type || body.type || body.topic || "";
      id = id || body?.data?.id || body?.id || "";
    }
  } catch { /* sin body JSON */ }

  if (!id) return NextResponse.json({ ok: true });

  try {
    if (type.includes("preapproval")) {
      const pre = await getPreapproval(id);
      await applyPreapproval(pre);
    } else if (type.includes("payment")) {
      // Pago de la suscripción aprobado → extendemos un mes.
      const pay = await getPayment(id);
      if (pay?.status === "approved") {
        const ref: string = pay?.external_reference || "";
        const [gymId, plan] = ref.split("|");
        if (gymId) {
          const patch: Record<string, unknown> = { status: "active", current_period_end: nextMonthIso() };
          if (plan) patch.plan = plan;
          await admin().from("subscriptions").update(patch).eq("gym_id", gymId);
        }
      }
    }
  } catch (e) {
    // Respondemos 200 igual para que MP no reintente en loop; queda el error en logs.
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }

  return NextResponse.json({ ok: true });
}
