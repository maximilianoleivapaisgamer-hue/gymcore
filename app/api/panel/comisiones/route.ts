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
 * ⚠️ Se cuenta la UNIÓN de reservas y asistencias, no una sola de las dos. Lo
 * decidió DanzArte: la reserva no cancelada a tiempo ya se le descontó al
 * socio (la clase se dio), y el que vino sin reservar también hizo la clase.
 * Contando solo reservas, sobre un mes real quedaban 156 clases dadas sin
 * pagar y 234 pagadas que nadie usó. Ver `asistenciasDeducidas` más abajo.
 *
 * ⚠️ El detalle (`profes[].detalle`) sale de las MISMAS unidades que el total,
 * no de una segunda cuenta, y se redondea de modo que la suma del detalle dé
 * exactamente el total. Si no cerraran, el número de arriba no se podría
 * defender frente a la profe y la pantalla no serviría para nada.
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

interface Cobro { member_id: string | null; amount: number; concept: string | null }

/**
 * Lo que NO se reparte con las profes.
 *
 * El recargo por pagar tarde es del estudio: no es plata de una clase que
 * alguien dio. Las sueltas tampoco — esas se cobran aparte y no corresponden
 * a la cuota del mes.
 *
 * ⚠️ Se filtra por el texto del concepto porque es lo que hay. Si alguna vez
 * se agrega una columna de tipo de ingreso, esto se reemplaza por eso.
 */
const NO_ES_CUOTA = /recargo|suelta/i;
interface Reserva { member_id: string; class_id: string; class_date: string }
interface Clase2 { id: string; instructor: string | null; weekdays: string[] | null; start_time: string | null }
interface Ingreso { member_id: string; entered_at: string }

/** Cuanto antes y despues del horario se acepta una entrada como "vino a esa clase". */
const ANTES_MIN = 40;
const DESPUES_MIN = 20;

const DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

/**
 * A que clase entro cada persona, deducido del control de acceso.
 *
 * ── Por que hace falta ──────────────────────────────────────────────────
 *
 * DanzArte cuenta "la reserva Y la asistencia", porque mucha gente se olvida
 * de reservar, viene igual y si hay lugar hace la clase. Medido sobre un mes
 * real: 156 clases se dieron sin reserva (hoy no se le pagaban a nadie) y 234
 * reservas no se usaron.
 *
 * ── Como se deduce ──────────────────────────────────────────────────────
 *
 * `attendances` guarda QUE la persona entro, no a que clase. Pero guarda la
 * HORA, y las clases tienen dia y horario. Si a esa hora hay una sola clase,
 * no hay nada que adivinar. Probado con los 542 ingresos de un mes de
 * DanzArte: el 95,2% cae en una sola clase y NINGUNO en dos.
 *
 * ⚠️ Si a esa hora hay DOS clases, se descarta en vez de adivinar. Puede pasar
 * en un gimnasio con horarios superpuestos, y pagarle a la profe equivocada es
 * peor que no contar esa entrada.
 */
function asistenciasDeducidas(ingresos: Ingreso[], clases: Clase2[]): Set<string> {
  const salida = new Set<string>();
  const conHorario = clases.filter((c) => c.start_time && (c.weekdays || []).length);

  for (const i of ingresos) {
    // La hora local de Argentina, que es con la que estan cargados los horarios.
    const local = new Date(new Date(i.entered_at).toLocaleString("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
    }));
    const dia = DIAS[local.getDay()];
    const minutos = local.getHours() * 60 + local.getMinutes();

    const candidatas = conHorario.filter((c) => {
      if (!(c.weekdays || []).includes(dia)) return false;
      const [h, m] = (c.start_time as string).slice(0, 5).split(":").map(Number);
      const arranca = h * 60 + m;
      return minutos >= arranca - ANTES_MIN && minutos <= arranca + DESPUES_MIN;
    });

    // Una sola: se cuenta. Ninguna o varias: se deja pasar.
    if (candidatas.length !== 1) continue;
    const fecha = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    salida.add(`${i.member_id}|${candidatas[0].id}|${fecha}`);
  }
  return salida;
}
interface Clase { id: string; instructor: string | null; name: string | null; start_time: string | null }

/** Una fila del detalle: una clase, un dia. */
interface Fila {
  class_id: string;
  clase: string;
  hora: string | null;
  fecha: string;
  /** Cuantas de las clases contadas para el reparto cayeron acá. */
  personas: number;
  /** Anotados y los que el control de acceso dice que vinieron, de verdad. */
  reservas: number;
  asistencias: number;
  /** Reservaron o vinieron, pero no pagaron nada este mes: no hay qué repartir. */
  sin_pago: number;
  atribuido: number;
  comision: number;
}

/**
 * Reparte un total en enteros que SUMAN EXACTO ese total.
 *
 * Redondear cada fila por su cuenta deja la suma del detalle distinta del
 * total de arriba por unos pesos, y eso es justo lo que hace desconfiar del
 * número entero. Se redondea para abajo y los pesos que sobran se le dan a
 * las filas de mayor resto.
 */
function enterosQueSuman(valores: number[], total: number): number[] {
  const piso = valores.map((v) => Math.floor(v));
  let falta = total - piso.reduce((a, b) => a + b, 0);
  const porResto = valores
    .map((v, i) => ({ i, resto: v - Math.floor(v) }))
    .sort((x, y) => y.resto - x.resto);
  for (const o of porResto) {
    if (falta === 0) break;
    // `falta` puede ser negativo si el total venía redondeado para abajo.
    piso[o.i] += falta > 0 ? 1 : -1;
    falta += falta > 0 ? -1 : 1;
  }
  return piso;
}
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

  const [{ data: cobrosRaw }, { data: reservasRaw }, { data: clasesRaw }, { data: sociosRaw }, { data: profesRaw }, { data: ingresosRaw }] =
    await Promise.all([
      // `concept` viene para poder sacar lo que NO es cuota: el recargo por
      // pago fuera de termino y las clases sueltas son del estudio, no entran
      // en el reparto con las profes. Lo confirmo DanzArte.
      sb.from("cashflow_entries").select("member_id, amount, concept")
        .eq("gym_id", perfil.gym_id).eq("type", "income").gte("date", desde).lt("date", hasta),
      sb.from("bookings").select("member_id, class_id, class_date")
        .eq("gym_id", perfil.gym_id).gte("class_date", desde).lt("class_date", hasta),
      // `name` y `start_time` son para el detalle: "Zumba, mié 17/09, 18:30".
      sb.from("classes").select("id, name, instructor, weekdays, start_time").eq("gym_id", perfil.gym_id),
      sb.from("members").select("id, full_name").eq("gym_id", perfil.gym_id),
      sb.from("profesores").select("nombre, porcentaje, activo").eq("gym_id", perfil.gym_id),
      // El control de acceso: de aca sale quien vino de verdad.
      sb.from("attendances").select("member_id, entered_at")
        .eq("gym_id", perfil.gym_id)
        .gte("entered_at", `${desde}T00:00:00-03:00`).lt("entered_at", `${hasta}T00:00:00-03:00`),
    ]);

  const nombreDe = new Map(((sociosRaw as Socio[]) || []).map((s) => [s.id, s.full_name]));
  const profeDeClase = new Map(
    ((clasesRaw as Clase[]) || [])
      .filter((c) => (c.instructor || "").trim())
      .map((c) => [c.id, (c.instructor as string).trim()]),
  );
  const nombreClase = new Map(((clasesRaw as Clase[]) || []).map((c) => [c.id, c.name || "Clase"]));
  const horaDe = new Map(
    ((clasesRaw as Clase[]) || []).map((c) => [c.id, c.start_time ? String(c.start_time).slice(0, 5) : null]),
  );
  const porcentajeDe = new Map(
    ((profesRaw as Profe[]) || []).map((p) => [parejo(p.nombre), Number(p.porcentaje)]),
  );

  // 1) Lo que pagó cada socio en el mes.
  const pagoDe = new Map<string, number>();
  ((cobrosRaw as Cobro[]) || []).forEach((c) => {
    if (!c.member_id) return;
    if (NO_ES_CUOTA.test(c.concept || "")) return;  // del estudio, no se reparte
    pagoDe.set(c.member_id, (pagoDe.get(c.member_id) || 0) + Number(c.amount || 0));
  });

  // 2) Cuántas clases hizo cada socio con cada profe.
  //
  // Se cuenta la UNIÓN de lo reservado y lo que el control de acceso dice que
  // efectivamente ocurrió. Lo decidió DanzArte: "los profes no faltan, asisten
  // igual y las clases no se suspenden", así que la clase reservada y no usada
  // igual se dio; y la que vino sin reservar también.
  //
  // Un mismo socio + clase + día cuenta UNA VEZ aunque esté en los dos lados:
  // por eso la clave compuesta y no dos contadores sumados.
  const deducidas = asistenciasDeducidas(
    (ingresosRaw as Ingreso[]) || [],
    (clasesRaw as Clase2[]) || [],
  );

  const reservadas = new Set<string>();
  ((reservasRaw as Reserva[]) || []).forEach((r) => {
    reservadas.add(`${r.member_id}|${r.class_id}|${String(r.class_date).slice(0, 10)}`);
  });
  const vistas = new Set<string>([...deducidas, ...reservadas]);

  // Cada clase contada, abierta: quién, cuál, qué día, y de dónde salió. De
  // acá sale tanto el reparto como el detalle, así que no pueden diferir.
  const unidades = [...vistas].map((clave) => {
    const [member_id, class_id, fecha] = clave.split("|");
    return {
      member_id, class_id, fecha,
      profe: profeDeClase.get(class_id) || "",
      reserva: reservadas.has(clave),
      asistencia: deducidas.has(clave),
    };
  }).filter((u) => u.profe);  // sin profe cargada no se le puede atribuir a nadie

  const clasesDe = new Map<string, Map<string, number>>();
  unidades.forEach((u) => {
    const suyas = clasesDe.get(u.member_id) || new Map<string, number>();
    suyas.set(u.profe, (suyas.get(u.profe) || 0) + 1);
    clasesDe.set(u.member_id, suyas);
  });

  // 3) El reparto.
  const porProfe = new Map<string, { plata: number; clases: number; socios: Set<string> }>();
  const sinAsignar: { member_id: string; nombre: string; pago: number }[] = [];
  // Cuánto vale UNA clase de ese socio: lo que pagó dividido las que hizo. Es
  // la pieza que permite abrir el total clase por clase sin recalcular nada.
  const valorDe = new Map<string, number>();
  let cobradoTotal = 0;

  pagoDe.forEach((pago, socioId) => {
    cobradoTotal += pago;
    const suyas = clasesDe.get(socioId);
    const total = suyas ? [...suyas.values()].reduce((a, b) => a + b, 0) : 0;

    if (!suyas || total === 0) {
      sinAsignar.push({ member_id: socioId, nombre: nombreDe.get(socioId) || "Socio", pago });
      return;
    }
    valorDe.set(socioId, pago / total);
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

  // 4) El detalle, una fila por profe + clase + día.
  //
  // Sale de las MISMAS unidades que el reparto de arriba, no de otra cuenta.
  // Es para la conversación incómoda: la profe dice "yo di más clases que eso"
  // y acá están, con fecha, horario y cuánta gente hubo en cada una.
  const detalleDe = new Map<string, Map<string, Fila>>();
  unidades.forEach((u) => {
    const suyas = detalleDe.get(u.profe) || new Map<string, Fila>();
    const clave = `${u.class_id}|${u.fecha}`;
    const fila = suyas.get(clave) || {
      class_id: u.class_id,
      clase: nombreClase.get(u.class_id) || "Clase",
      hora: horaDe.get(u.class_id) ?? null,
      fecha: u.fecha,
      personas: 0, reservas: 0, asistencias: 0, sin_pago: 0,
      atribuido: 0, comision: 0,
    };
    // Anotados y presentes son la realidad, hayan pagado o no.
    if (u.reserva) fila.reservas += 1;
    if (u.asistencia) fila.asistencias += 1;
    const valor = valorDe.get(u.member_id);
    // Sin pago en el mes no hay nada para repartir, pero la clase se dio: se
    // muestra aparte en vez de desaparecer, si no la profe cuenta más gente
    // de la que figura y el número parece estar mal.
    if (valor === undefined) fila.sin_pago += 1;
    else { fila.personas += 1; fila.atribuido += valor; }
    suyas.set(clave, fila);
    detalleDe.set(u.profe, suyas);
  });

  const profes = [...porProfe.entries()].map(([nombre, f]) => {
    const porcentaje = porcentajeDe.get(parejo(nombre)) ?? PORCENTAJE_POR_DEFECTO;
    // Lo que de la plata cobrada corresponde a sus clases, y lo que hay que pagarle.
    const atribuido = Math.round(f.plata);
    const comision = Math.round((f.plata * porcentaje) / 100);

    // Las más nuevas arriba, y dentro del día por horario.
    const filas = [...(detalleDe.get(nombre)?.values() || [])].sort((x, y) =>
      x.fecha === y.fecha ? (x.hora || "").localeCompare(y.hora || "") : y.fecha.localeCompare(x.fecha),
    );
    const sueltos = enterosQueSuman(filas.map((x) => x.atribuido), atribuido);
    const cobros = enterosQueSuman(filas.map((x) => (x.atribuido * porcentaje) / 100), comision);

    return {
      nombre,
      porcentaje,
      clases: f.clases,
      socios: f.socios.size,
      atribuido,
      comision,
      // Si esta profe ya tiene su porcentaje cargado o está con el de por defecto.
      cargada: porcentajeDe.has(parejo(nombre)),
      detalle: filas.map((x, i) => ({ ...x, atribuido: sueltos[i], comision: cobros[i] })),
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
