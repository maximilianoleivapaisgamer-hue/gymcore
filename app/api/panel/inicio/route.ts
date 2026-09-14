import { NextResponse } from "next/server";
import { contexto, esFallo } from "@/lib/panel";

/**
 * Todo lo que necesita el tablero del panel, en UN solo pedido.
 *
 *   GET /api/panel/inicio?sede=<id opcional>
 *
 * Mismo motivo que `/api/panel/clases`: el navegador encadenaba cinco viajes a
 * la base. Ver `lib/panel.ts`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Una fecha "2026-09-14" en hora local del servidor. */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function GET(req: Request) {
  const sede = new URL(req.url).searchParams.get("sede");
  const ctx = await contexto(sede);
  if (esFallo(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });

  const { sb, perfil, sedes, sedeId } = ctx;
  if (!perfil.gym_id) {
    return NextResponse.json({
      ok: true, perfil, sedes, sede_id: null,
      gimnasio: null, socios: [], caja: [], asistencias_hoy: 0,
    });
  }

  const ahora = new Date();
  const desde = iso(new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1));
  const arrancoElDia = new Date(); arrancoElDia.setHours(0, 0, 0, 0);

  let qCaja = sb.from("cashflow_entries").select("date, type, amount")
    .eq("gym_id", perfil.gym_id).gte("date", desde);
  // Se incluyen los movimientos sin sucursal: si alguno se guardó sin sede,
  // mejor que se vea a que la plata desaparezca del panel.
  if (sedeId) qCaja = qCaja.or(`sede_id.eq.${sedeId},sede_id.is.null`);

  let qAsistencias = sb.from("attendances").select("id", { count: "exact", head: true })
    .eq("gym_id", perfil.gym_id).gte("entered_at", arrancoElDia.toISOString());
  if (sedeId) qAsistencias = qAsistencias.eq("sede_id", sedeId);

  const [{ data: gym }, { data: socios }, { data: caja }, { count: asistencias }] = await Promise.all([
    sb.from("gyms").select("name").eq("id", perfil.gym_id).maybeSingle<{ name: string }>(),
    // El filtro por gimnasio faltaba acá también: dependía solo de RLS.
    sb.from("members")
      .select("id, full_name, whatsapp, plan_name, plan_price, membership_expiry, created_at")
      .eq("gym_id", perfil.gym_id),
    qCaja,
    qAsistencias,
  ]);

  return NextResponse.json({
    ok: true,
    perfil,
    sedes,
    sede_id: sedeId,
    gimnasio: gym?.name || "",
    socios: socios || [],
    caja: caja || [],
    asistencias_hoy: asistencias ?? 0,
  });
}
