import { NextResponse } from "next/server";
import { contexto, esFallo } from "@/lib/panel";

/**
 * Cuánto le toca a cada profe en un mes.
 *
 *   GET /api/panel/comisiones?mes=2026-09
 *
 * ── LA REGLA, como la definió DanzArte ──────────────────────────────────
 *
 *   "50% queda DanzArte, el resto se divide por profesor según cantidad de
 *    clases, para que sea equitativo. Y el porcentaje sí, por ahora 50%; para
 *    los profesores nuevos es 40%."
 *
 * Socio por socio:
 *   1. Se toma lo que ESE socio pagó en el mes.
 *   2. Se reparte entre las profes según cuántas clases hizo con cada una.
 *      8 clases con Karina y 4 con Priscila ⇒ 2/3 y 1/3, NO mitad y mitad.
 *   3. Cada profe cobra SU porcentaje de la parte que le tocó.
 *
 * ⚠️ Se cuentan las RESERVAS, no las asistencias. Es a propósito y es correcto
 * para este negocio: DanzArte tiene prendida la regla de "si no cancelás a
 * tiempo, perdiste la clase", así que una reserva ES una clase consumida.
 * Además `attendances` no guarda a qué clase entró la persona, así que no
 * serviría para repartir entre profes aunque quisiéramos.
 *
 * ⚠️ La plata de quien pagó y NO reservó nada no se le asigna a nadie: se
 * devuelve aparte, con nombre y apellido. Sin eso, la suma de las comisiones no
 * cierra contra lo cobrado y el dueño piensa que el sistema está roto. En
 * DanzArte son $453.000 de $2.584.994 — 11 socias nuevas que todavía no
 * reservaron nunca. Mostrarlo sirve de alerta: es plata que se puede ir.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El 50% de DanzArte es lo normal; se cambia por profe desde la pantalla. */
const PORCENTAJE_POR_DEFECTO = 50;

/**
 * Cambiar el porcentaje de una profe.
 *
 *   POST { nombre, porcentaje }
 *
 * Va por acá y no con un `upsert` desde el navegador por una razón concreta:
 * el índice único de `profesores` es sobre `lower(btrim(nombre))` — para que
 * "Karina " y "karina" no se vuelvan dos profesoras distintas — y Postgres NO
 * acepta un `ON CONFLICT (gym_id, nombre)` contra un índice así. Probado: tira
 * "there is no unique or exclusion constraint matching the ON CONFLICT
 * specification". O sea que el upsert fallaba callado: la dueña cambiaba el
 * porcentaje, no se guardaba nada, y el número seguía igual.
 */
export async function POST(req: Request) {
  const ctx = await contexto(null);
  if (esFallo(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const { sb, perfil } = ctx;
  if (!perfil.gym_id) return NextResponse.json({ ok: false, error: "Sin gimnasio." }, { status: 403 });

  let body: { nombre?: string; porcentaje?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 }); }

  const nombre = String(body.nombre || "").trim();
  const porcentaje = Number(body.porcentaje);
  if (!nombre) return NextResponse.json({ ok: false, error: "Falta el nombre de la profe." }, { status: 400 });
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    return NextResponse.json({ ok: false, error: "El porcentaje va de 0 a 100." }, { status: 400 });
  }

  // Son pocas (una por profe del gimnasio), así que se comparan acá con el
  // mismo criterio que el índice: sin mayúsculas ni espacios de sobra.
  const { data: existentes } = await sb
    .from("profesores").select("id, nombre").eq("gym_id", perfil.gym_id);
  const ya = ((existentes as { id: string; nombre: string }[]) || [])
    .find((p) => parejo(p.nombre) === parejo(nombre));

  const { error } = ya
    ? await sb.from("profesores").update({ porcentaje }).eq("id", ya.id)
    : await sb.from("profesores").insert({ gym_id: perfil.gym_id, nombre, porcentaje });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** Para cruzar `classes.instructor` (texto libre) con la profe cargada. */
const parejo = (s: string) => s.trim().toLowerCase();

interface Cobro { member_id: string | null; amount: number }
interface Reserva { member_id: string; class_id: string }
interface Clase { id: string; instructor: string | null }
interface Socio { id: string; full_name: string }
interface Profe { nombre: string; porcentaje: number; activo: boolean }

export async function GET(req: Request) {
  const ctx = await contexto(new URL(req.url).searchParams.get("sede"));
  if (esFallo(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const { sb, perfil } = ctx;
  if (!perfil.gym_id) return NextResponse.json({ ok: false, error: "Sin gimnasio." }, { status: 403 });

  // El mes que se mira, como "2026-09". Por defecto, el corriente.
  const pedido = new URL(req.url).searchParams.get("mes") || "";
  const mes = /^\d{4}-\d{2}$/.test(pedido)
    ? pedido
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit",
      }).format(new Date()).slice(0, 7);

  const desde = `${mes}-01`;
  const [a, m] = mes.split("-").map(Number);
  const hasta = `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;

  const [{ data: cobrosRaw }, { data: reservasRaw }, { data: clasesRaw }, { data: sociosRaw }, { data: profesRaw }] =
    await Promise.all([
      sb.from("cashflow_entries").select("member_id, amount")
        .eq("gym_id", perfil.gym_id).eq("type", "income").gte("date", desde).lt("date", hasta),
      sb.from("bookings").select("member_id, class_id")
        .eq("gym_id", perfil.gym_id).gte("class_date", desde).lt("class_date", hasta),
      sb.from("classes").select("id, instructor").eq("gym_id", perfil.gym_id),
      sb.from("members").select("id, full_name").eq("gym_id", perfil.gym_id),
      sb.from("profesores").select("nombre, porcentaje, activo").eq("gym_id", perfil.gym_id),
    ]);

  const nombreDe = new Map(((sociosRaw as Socio[]) || []).map((s) => [s.id, s.full_name]));
  const profeDeClase = new Map(
    ((clasesRaw as Clase[]) || [])
      .filter((c) => (c.instructor || "").trim())
      .map((c) => [c.id, (c.instructor as string).trim()]),
  );
  const porcentajeDe = new Map(
    ((profesRaw as Profe[]) || []).map((p) => [parejo(p.nombre), Number(p.porcentaje)]),
  );

  // 1) Lo que pagó cada socio en el mes.
  const pagoDe = new Map<string, number>();
  ((cobrosRaw as Cobro[]) || []).forEach((c) => {
    if (!c.member_id) return;
    pagoDe.set(c.member_id, (pagoDe.get(c.member_id) || 0) + Number(c.amount || 0));
  });

  // 2) Cuántas clases hizo cada socio con cada profe.
  const clasesDe = new Map<string, Map<string, number>>();
  ((reservasRaw as Reserva[]) || []).forEach((r) => {
    const profe = profeDeClase.get(r.class_id);
    if (!profe) return;  // clase sin profe cargada: no se le puede atribuir
    const suyas = clasesDe.get(r.member_id) || new Map<string, number>();
    suyas.set(profe, (suyas.get(profe) || 0) + 1);
    clasesDe.set(r.member_id, suyas);
  });

  // 3) El reparto.
  const porProfe = new Map<string, { plata: number; clases: number; socios: Set<string> }>();
  const sinAsignar: { member_id: string; nombre: string; pago: number }[] = [];
  let cobradoTotal = 0;

  pagoDe.forEach((pago, socioId) => {
    cobradoTotal += pago;
    const suyas = clasesDe.get(socioId);
    const total = suyas ? [...suyas.values()].reduce((a, b) => a + b, 0) : 0;

    if (!suyas || total === 0) {
      sinAsignar.push({ member_id: socioId, nombre: nombreDe.get(socioId) || "Socio", pago });
      return;
    }
    suyas.forEach((cuantas, profe) => {
      const fila = porProfe.get(profe) || { plata: 0, clases: 0, socios: new Set<string>() };
      fila.plata += (pago * cuantas) / total;
      fila.clases += cuantas;
      fila.socios.add(socioId);
      porProfe.set(profe, fila);
    });
  });

  // Las profes que dieron clase pero cuyos socios no pagaron en el mes igual
  // aparecen, en cero: que una profe falte de la lista asusta más que un cero.
  clasesDe.forEach((suyas) => {
    suyas.forEach((_, profe) => {
      if (!porProfe.has(profe)) porProfe.set(profe, { plata: 0, clases: 0, socios: new Set() });
    });
  });

  const profes = [...porProfe.entries()].map(([nombre, f]) => {
    const porcentaje = porcentajeDe.get(parejo(nombre)) ?? PORCENTAJE_POR_DEFECTO;
    return {
      nombre,
      porcentaje,
      clases: f.clases,
      socios: f.socios.size,
      // Lo que de la plata cobrada corresponde a sus clases.
      atribuido: Math.round(f.plata),
      // Lo que hay que pagarle.
      comision: Math.round((f.plata * porcentaje) / 100),
      // Si esta profe ya tiene su porcentaje cargado o está con el de por defecto.
      cargada: porcentajeDe.has(parejo(nombre)),
    };
  }).sort((x, y) => y.comision - x.comision);

  const aPagar = profes.reduce((a, p) => a + p.comision, 0);
  const plataSinAsignar = sinAsignar.reduce((a, s) => a + s.pago, 0);

  return NextResponse.json({
    ok: true,
    mes,
    cobrado: Math.round(cobradoTotal),
    a_pagar: aPagar,
    queda_para_el_gimnasio: Math.round(cobradoTotal) - aPagar,
    profes,
    sin_asignar: {
      plata: Math.round(plataSinAsignar),
      socios: sinAsignar.sort((x, y) => y.pago - x.pago),
    },
  });
}
