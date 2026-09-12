import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase-server";
import { admin, moverFila, accesoAlGym } from "@/lib/espera";

/**
 * "Se liberó un lugar": mueve la fila de espera de una clase.
 *
 *   POST { class_id, class_date }
 *
 * Se llama JUSTO DESPUÉS de que se borra una reserva, desde los dos lugares
 * donde eso pasa: la app del socio cuando cancela, y el panel del dueño cuando
 * saca a alguien de la clase.
 *
 * Va acá y no en un cron a propósito: el disparador de los crons es GitHub
 * Actions, que medido sobre un día real corrió cada 2 a 5 horas. Enterarte de
 * que se liberó un lugar cuatro horas después no sirve de nada. El cron igual
 * pasa a barrer los turnos vencidos, pero el aviso que importa sale de acá, en
 * el momento.
 *
 * Es idempotente: llamarlo de más no rompe nada ni manda avisos de más.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const sb = admin();
  if (!sb) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });

  const { data: { user } } = await createServer().auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  let body: { class_id?: string; class_date?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 }); }
  const claseId = String(body.class_id || "").trim();
  const fecha = String(body.class_date || "").trim();
  if (!claseId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ ok: false, error: "Faltan datos de la clase." }, { status: 400 });
  }

  const { data: clase } = await sb
    .from("classes").select("id, gym_id").eq("id", claseId)
    .maybeSingle<{ id: string; gym_id: string }>();
  if (!clase) return NextResponse.json({ ok: false, error: "Esa clase no existe." }, { status: 404 });

  if (!(await accesoAlGym(sb, user.id, clase.gym_id))) {
    return NextResponse.json({ ok: false, error: "No es tu gimnasio." }, { status: 403 });
  }

  const r = await moverFila(sb, claseId, fecha);
  return NextResponse.json({ ok: true, ...r });
}
