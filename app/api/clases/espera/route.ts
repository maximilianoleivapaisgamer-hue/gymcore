import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase-server";
import { admin, moverFila, limpiarViejas, type Admin, type FilaEspera } from "@/lib/espera";

/**
 * La lista de espera, del lado del socio.
 *
 *   GET                          → en qué filas está y qué puesto tiene
 *   POST   { class_id, class_date } → se anota
 *   DELETE { class_id, class_date } → se baja
 *
 * El socio sale de la SESIÓN, nunca del cuerpo del pedido: nadie puede anotar
 * ni bajar a otro. La tabla tiene RLS sin políticas, así que solo se toca desde
 * acá con el service role.
 *
 * El GET además HACE MOVER la fila de las clases donde el socio espera. Es lo
 * que hace que abrir la app alcance para que la fila avance cuando al de
 * adelante se le pasó el turno, sin depender del cron (que corre cada varias
 * horas).
 */
export const runtime = "nodejs";
export const maxDuration = 30;

/** Tope de filas por socio, para que nadie se anote en todo el cronograma. */
const MAX_POR_SOCIO = 20;

const hoyArg = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

async function socioDe(sb: Admin, userId: string) {
  const { data } = await sb
    .from("members").select("id, gym_id, membership_expiry").eq("linked_user_id", userId)
    .maybeSingle<{ id: string; gym_id: string; membership_expiry: string | null }>();
  return data;
}

/** Quién llama, ya resuelto contra la base. */
async function quien(req?: Request) {
  const sb = admin();
  if (!sb) return { error: "Falta configuración del servidor.", status: 500 as const };
  const { data: { user } } = await createServer().auth.getUser();
  if (!user) return { error: "No autenticado.", status: 401 as const };
  const socio = await socioDe(sb, user.id);
  if (!socio) return { error: "Tu cuenta no está vinculada a un socio.", status: 403 as const };

  let body: { class_id?: string; class_date?: string } = {};
  if (req) { try { body = await req.json(); } catch { /* GET no trae cuerpo */ } }
  return { sb, socio, body };
}

export async function GET() {
  const q = await quien();
  if ("error" in q) return NextResponse.json({ ok: false, error: q.error }, { status: q.status });
  const { sb, socio } = q;

  const hoy = hoyArg();
  await limpiarViejas(sb, hoy);

  const { data: mias } = await sb
    .from("class_waitlist").select("class_id, class_date")
    .eq("member_id", socio.id).gte("class_date", hoy);
  const claves = (mias as { class_id: string; class_date: string }[]) || [];
  if (claves.length === 0) return NextResponse.json({ ok: true, esperas: [] });

  // Abrir la app mueve la fila: si al de adelante se le pasó el turno, acá se
  // lo manda al fondo y se le ofrece el lugar al que sigue.
  //
  // Solo las de los próximos días, y pocas: cada una son varias consultas y
  // esto corre en CADA carga del portal. Un lugar que se libera para dentro de
  // dos semanas no es urgente — de esas se ocupa el cron.
  const tope = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const urgentes = claves.filter((c) => c.class_date <= tope).slice(0, 5);
  for (const c of urgentes) await moverFila(sb, c.class_id, c.class_date);

  // Y recién ahora se lee el estado final, ya movido.
  const esperas = [];
  for (const c of claves) {
    const { data: filaRaw } = await sb
      .from("class_waitlist").select("id, member_id, class_id, class_date, created_at, ofrecido_at, vence_at")
      .eq("class_id", c.class_id).eq("class_date", c.class_date)
      .order("created_at", { ascending: true });
    const fila = (filaRaw as FilaEspera[]) || [];
    const i = fila.findIndex((f) => f.member_id === socio.id);
    if (i < 0) continue;
    const yo = fila[i];
    esperas.push({
      class_id: c.class_id,
      class_date: c.class_date,
      puesto: i + 1,
      cuantos: fila.length,
      // Solo es "tu lugar" si el turno sigue vigente.
      vence_at: yo.vence_at && new Date(yo.vence_at).getTime() > Date.now() ? yo.vence_at : null,
    });
  }
  return NextResponse.json({ ok: true, esperas });
}

export async function POST(req: Request) {
  const q = await quien(req);
  if ("error" in q) return NextResponse.json({ ok: false, error: q.error }, { status: q.status });
  const { sb, socio, body } = q;

  const claseId = String(body.class_id || "").trim();
  const fecha = String(body.class_date || "").trim();
  if (!claseId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ ok: false, error: "Faltan datos de la clase." }, { status: 400 });
  }
  if (fecha < hoyArg()) {
    return NextResponse.json({ ok: false, error: "Esa clase ya pasó." }, { status: 400 });
  }

  // La clase tiene que ser DE SU GIMNASIO. Sin esto, mandando un id de otro
  // estudio se podría espiar el cupo ajeno.
  const { data: clase } = await sb
    .from("classes").select("id, gym_id, sede_id, capacity").eq("id", claseId)
    .maybeSingle<{ id: string; gym_id: string; sede_id: string | null; capacity: number | null }>();
  if (!clase || clase.gym_id !== socio.gym_id) {
    return NextResponse.json({ ok: false, error: "Esa clase no existe." }, { status: 404 });
  }
  if (!clase.capacity || clase.capacity <= 0) {
    return NextResponse.json({ ok: false, error: "Esta clase no tiene cupo limitado: reservá directamente." }, { status: 400 });
  }

  // Si el negocio corta las reservas al vencimiento de la cuota, esperar por
  // una clase posterior no sirve para nada: el día que le toque, el trigger
  // `enforce_booking_expiry` no lo va a dejar entrar igual.
  const { data: gym } = await sb
    .from("gyms").select("reserva_hasta_vencimiento").eq("id", socio.gym_id)
    .maybeSingle<{ reserva_hasta_vencimiento: boolean | null }>();
  if (gym?.reserva_hasta_vencimiento && socio.membership_expiry && fecha > socio.membership_expiry) {
    return NextResponse.json(
      { ok: false, error: "Tu cuota está paga hasta antes de esa fecha. Renovala para anotarte." },
      { status: 400 },
    );
  }

  // Solo se espera por lo que está lleno. Si hay lugar, que reserve y listo.
  //
  // Se cuenta igual que el trigger `enforce_class_capacity`: las reservas MÁS
  // los lugares que están guardados para alguien de la fila. Si no, en la media
  // hora que dura un turno la clase parecería tener un lugar libre que en
  // realidad no se puede tomar, y al socio se le diría "reservá directamente"
  // para después rebotarlo.
  const [{ count }, { count: guardados }] = await Promise.all([
    sb.from("bookings").select("id", { count: "exact", head: true })
      .eq("class_id", claseId).eq("class_date", fecha),
    sb.from("class_waitlist").select("id", { count: "exact", head: true })
      .eq("class_id", claseId).eq("class_date", fecha)
      .neq("member_id", socio.id).gt("vence_at", new Date().toISOString()),
  ]);
  if ((count ?? 0) + (guardados ?? 0) < clase.capacity) {
    return NextResponse.json({ ok: false, error: "Quedan lugares: reservá directamente." }, { status: 409 });
  }

  const { count: cuantas } = await sb
    .from("class_waitlist").select("id", { count: "exact", head: true })
    .eq("member_id", socio.id).gte("class_date", hoyArg());
  if ((cuantas ?? 0) >= MAX_POR_SOCIO) {
    return NextResponse.json(
      { ok: false, error: `Ya estás en ${MAX_POR_SOCIO} listas de espera. Bajate de alguna para sumarte a esta.` },
      { status: 400 },
    );
  }

  const { error } = await sb.from("class_waitlist").insert({
    gym_id: socio.gym_id,
    sede_id: clase.sede_id,
    class_id: claseId,
    member_id: socio.id,
    class_date: fecha,
  });
  // El único choque posible es el índice único: ya estaba anotado.
  if (error && !String(error.message).includes("duplicate")) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const { data: filaRaw } = await sb
    .from("class_waitlist").select("member_id")
    .eq("class_id", claseId).eq("class_date", fecha)
    .order("created_at", { ascending: true });
  const fila = (filaRaw as { member_id: string }[]) || [];
  const puesto = fila.findIndex((f) => f.member_id === socio.id) + 1;

  return NextResponse.json({ ok: true, puesto, cuantos: fila.length });
}

export async function DELETE(req: Request) {
  const q = await quien(req);
  if ("error" in q) return NextResponse.json({ ok: false, error: q.error }, { status: q.status });
  const { sb, socio, body } = q;

  const claseId = String(body.class_id || "").trim();
  const fecha = String(body.class_date || "").trim();
  if (!claseId || !fecha) {
    return NextResponse.json({ ok: false, error: "Faltan datos de la clase." }, { status: 400 });
  }

  // El filtro por member_id es el que importa: aunque manden otra clase, solo
  // se borra lo propio.
  const { error } = await sb.from("class_waitlist").delete()
    .eq("member_id", socio.id).eq("class_id", claseId).eq("class_date", fecha);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  // Al irse el primero de la fila, el lugar pasa al que sigue.
  await moverFila(sb, claseId, fecha);
  return NextResponse.json({ ok: true });
}
