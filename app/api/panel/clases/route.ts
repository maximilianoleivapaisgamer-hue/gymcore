import { NextResponse } from "next/server";
import { contexto, esFallo } from "@/lib/panel";
import { asistenciasDeducidas, hoyEnArgentina, type ClaseConHorario, type Ingreso } from "@/lib/asistencias";
import type { RealPlan } from "@/types/db";

/**
 * Todo lo que necesita la pantalla de Clases, en UN solo pedido.
 *
 *   GET /api/panel/clases?sede=<id opcional>
 *
 * Antes el navegador encadenaba cinco viajes a la base esperando uno al otro.
 * Ahora hace este, y el encadenamiento pasa entre el servidor y la base, que
 * están los dos en la nube. Ver `lib/panel.ts`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sede = new URL(req.url).searchParams.get("sede");
  const ctx = await contexto(sede);
  if (esFallo(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const { sb, perfil, sedes, sedeId } = ctx;
  if (!perfil.gym_id) {
    return NextResponse.json({
      ok: true, perfil, sedes, sede_id: null,
      planes: [], clases: [], socios: [], reservas: [],
    });
  }

  // La fecha de ARGENTINA, no la del servidor. `toISOString()` da UTC, y desde
  // las 21 de Argentina eso ya es el dia siguiente: las clases de la noche
  // (DanzArte tiene hasta las 20:30) quedaban del lado equivocado del corte.
  const hoy = hoyEnArgentina();

  let qClases = sb.from("classes").select("*").eq("gym_id", perfil.gym_id).order("start_time");
  let qReservas = sb.from("bookings").select("class_id, class_date")
    .eq("gym_id", perfil.gym_id).gte("class_date", hoy);
  if (sedeId) {
    qClases = qClases.eq("sede_id", sedeId);
    qReservas = qReservas.eq("sede_id", sedeId);
  }

  const [{ data: gym }, { data: clases }, { data: socios }, { data: reservas }] = await Promise.all([
    sb.from("gyms").select("real_plans, clases_reinicio").eq("id", perfil.gym_id)
      .maybeSingle<{ real_plans: RealPlan[] | null; clases_reinicio: string | null }>(),
    qClases,
    // El filtro por gimnasio faltaba: dependía solo de RLS. Los socios son
    // compartidos entre sucursales, así que acá no se filtra por sede.
    sb.from("members").select("id, full_name, plan_name, membership_expiry")
      .eq("gym_id", perfil.gym_id).order("full_name"),
    qReservas,
  ]);

  // Quien ENTRO de verdad hoy, para poder contrastar anotados vs asistieron.
  // Se deduce del control de acceso por el horario, igual que en comisiones:
  // `attendances` guarda que la persona entro, no a que clase, pero guarda la
  // hora y las clases tienen dia y horario. Lo pidio DanzArte porque les pasa
  // tener 20 anotadas y 40 que vinieron.
  const { data: ingresos } = await sb
    .from("attendances").select("member_id, entered_at")
    .eq("gym_id", perfil.gym_id)
    .gte("entered_at", `${hoy}T00:00:00-03:00`);

  const asistieron = [...asistenciasDeducidas(
    (ingresos as Ingreso[]) || [],
    (clases || []) as ClaseConHorario[],
  )].map((clave) => {
    const [member_id, class_id, fecha] = clave.split("|");
    return { member_id, class_id, fecha };
  });

  return NextResponse.json({
    ok: true,
    asistieron,
    perfil,
    sedes,
    sede_id: sedeId,
    planes: gym?.real_plans || [],
    clases_reinicio: gym?.clases_reinicio ?? null,
    clases: clases || [],
    socios: socios || [],
    reservas: reservas || [],
  });
}
