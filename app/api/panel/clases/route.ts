import { NextResponse } from "next/server";
import { contexto, esFallo } from "@/lib/panel";
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
  const hoy = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

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
  const DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
  const { data: ingresos } = await sb
    .from("attendances").select("member_id, entered_at")
    .eq("gym_id", perfil.gym_id)
    .gte("entered_at", `${hoy}T00:00:00-03:00`);

  const asistieron: { member_id: string; class_id: string; fecha: string }[] = [];
  const conHorario = ((clases || []) as { id: string; weekdays: string[] | null; start_time: string | null }[])
    .filter((c) => c.start_time && (c.weekdays || []).length);

  ((ingresos as { member_id: string; entered_at: string }[]) || []).forEach((i) => {
    const local = new Date(new Date(i.entered_at).toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    }));
    const dia = DIAS[local.getDay()];
    const min = local.getHours() * 60 + local.getMinutes();
    const cand = conHorario.filter((c) => {
      if (!(c.weekdays || []).includes(dia)) return false;
      const [h, m] = (c.start_time as string).slice(0, 5).split(":").map(Number);
      const arranca = h * 60 + m;
      return min >= arranca - 40 && min <= arranca + 20;
    });
    // Dos clases a la misma hora: se descarta en vez de adivinar.
    if (cand.length !== 1) return;
    asistieron.push({
      member_id: i.member_id,
      class_id: cand[0].id,
      fecha: `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`,
    });
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
