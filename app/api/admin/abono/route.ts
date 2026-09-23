import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { proximoVencimiento } from "@/lib/abono";

/**
 * El abono de un cliente, desde el panel del super admin.
 *
 *   POST { gym_id, accion: "registrar_pago", plan?, metodo? }
 *   POST { gym_id, accion: "dias_gracia", dias | null }
 *
 * "registrar_pago" es el botón de un toque para cuando el cliente transfiere y
 * avisa por WhatsApp. Antes había que editar el estado y la fecha a mano, y la
 * fecha escrita a ojo es justo lo que hace que a alguien se le corte el sistema
 * por un día mal tipeado.
 *
 * Deja el vencimiento donde corresponde (ver `proximoVencimiento`), lo pone al
 * día y, si estaba cortado, lo destapa.
 */
export const runtime = "nodejs";

async function guard() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { error: "Falta configuración del servidor.", status: 500 as const };
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: "No autenticado.", status: 401 as const };
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id)
    .maybeSingle<{ role: string }>();
  if (me?.role !== "super_admin") return { error: "Solo el super admin.", status: 403 as const };
  return { admin };
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  let body: { gym_id?: string; accion?: string; plan?: string; metodo?: string; dias?: number | null };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 }); }

  const gymId = String(body.gym_id || "").trim();
  if (!gymId) return NextResponse.json({ ok: false, error: "Falta el gimnasio." }, { status: 400 });

  const { data: sub } = await g.admin
    .from("subscriptions").select("plan, status, current_period_end, payment_method, dias_gracia")
    .eq("gym_id", gymId)
    .maybeSingle<{ plan: string; status: string; current_period_end: string | null; payment_method: string | null; dias_gracia: number | null }>();

  // ── Días de gracia de ESTE cliente ───────────────────────────────────
  if (body.accion === "dias_gracia") {
    const dias = body.dias;
    if (dias !== null && (!Number.isInteger(dias) || (dias as number) < 0 || (dias as number) > 3650)) {
      return NextResponse.json({ ok: false, error: "Los días van de 0 a 3650, o vacío para usar el general." }, { status: 400 });
    }
    const { error } = await g.admin.from("subscriptions")
      .upsert({ gym_id: gymId, plan: sub?.plan || "basico", status: sub?.status || "trial", dias_gracia: dias },
        { onConflict: "gym_id" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, dias_gracia: dias });
  }

  // ── Le entró la plata ────────────────────────────────────────────────
  if (body.accion === "registrar_pago") {
    const hasta = proximoVencimiento(sub?.current_period_end);
    const { error } = await g.admin.from("subscriptions").upsert({
      gym_id: gymId,
      plan: body.plan || sub?.plan || "basico",
      status: "active",
      payment_method: body.metodo || sub?.payment_method || "transferencia",
      // Medianoche de Argentina: la fecha que se ve es la que se guarda.
      current_period_end: `${hasta}T03:00:00.000Z`,
      // Si estaba cortado, se destapa. Esto es lo que hace que el cliente vea
      // el panel de vuelta sin tener que esperar nada ni pedir nada.
      cortado_at: null,
    }, { onConflict: "gym_id" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, vence: hasta });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
