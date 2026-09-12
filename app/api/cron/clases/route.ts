import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { enviarAviso, pushConfigurado, type Suscripcion } from "@/lib/push";

/**
 * Aviso "tu clase empieza pronto".
 *
 * Recorre las reservas de HOY que todavía no fueron avisadas y cuya clase
 * arranca dentro de las próximas horas, y le manda el aviso al celular del
 * socio. Se marca `bookings.aviso_clase_at` para no repetir.
 *
 * PENSADO PARA CORRER SEGUIDO, pero sin depender de que así sea. La ventana y
 * la marca lo hacen idempotente: corriendo dos veces en el mismo rato no manda
 * nada dos veces, y corriendo una sola vez al día igual avisa de las clases de
 * las próximas horas.
 *
 * ⚠️ El disparador real es un workflow de GitHub Actions, y GitHub estrangula
 * las tareas programadas: medido sobre un día entero corrió cada 2 a 5 horas,
 * no cada hora. Por eso la ventana es de 5 horas y no de 2 — si fuera corta,
 * una clase podría caer en un hueco entre corridas y quedarse sin aviso.
 *
 * Protegido con CRON_SECRET, igual que el cron de WhatsApp: si falta, no corre
 * (falla cerrado, no manda nada).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/**
  * Con cuánta anticipación avisamos.
  *
  * Son 5 y no 2 a propósito. El disparador es un workflow de GitHub Actions, y
  * GitHub estrangula las tareas programadas: medido sobre un día real, corrió
  * cada 2 a 5 horas en vez de cada hora. Con una ventana de 3 horas, una clase
  * podía caer justo en un hueco entre corridas y quedarse SIN aviso.
  *
  * Con 5 horas el aviso a veces llega más temprano de lo ideal, pero llega. El
  * texto dice las horas reales que faltan, así que se entiende igual.
  */
const HORAS_ANTES = 5;
/** Tope por corrida, para que una tanda rara no se vaya de las manos. */
const MAX_ENVIOS = 500;

const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : "");

/** Ahora mismo en Argentina, como fecha "2026-09-11" y minutos del día. */
function ahoraEnArgentina() {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    minutos: Number(p.hour) * 60 + Number(p.minute),
  };
}

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json({ ok: false, error: "Falta CRON_SECRET." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  if (!pushConfigurado()) {
    return NextResponse.json({ ok: false, error: "Faltan las claves VAPID." }, { status: 503 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "Falta configuración de Supabase." }, { status: 500 });
  }
  const sb = createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { fecha, minutos } = ahoraEnArgentina();
  const hasta = minutos + HORAS_ANTES * 60;

  // 1) Reservas de hoy sin avisar. El índice parcial de migration_052 hace que
  //    esto no recorra la tabla entera.
  const { data: reservas } = await sb
    .from("bookings").select("id, class_id, member_id, gym_id")
    .eq("class_date", fecha).is("aviso_clase_at", null).limit(2000);
  const filas = (reservas as { id: string; class_id: string; member_id: string; gym_id: string }[]) || [];
  if (filas.length === 0) {
    return NextResponse.json({ ok: true, fecha, revisadas: 0, avisos: 0 });
  }

  // 2) Las clases de esas reservas, para saber a qué hora arrancan.
  const idsClases = [...new Set(filas.map((r) => r.class_id))];
  const { data: clases } = await sb
    .from("classes").select("id, name, start_time, image_url").in("id", idsClases);
  const porClase = new Map(
    ((clases as { id: string; name: string; start_time: string | null; image_url: string | null }[]) || [])
      .map((c) => [c.id, c]),
  );

  // 3) Solo las que arrancan de acá a HORAS_ANTES. Las que ya empezaron no:
  //    un aviso de algo que pasó es peor que ningún aviso.
  const aAvisar = filas.filter((r) => {
    const c = porClase.get(r.class_id);
    if (!c?.start_time) return false;
    const [h, m] = hhmm(c.start_time).split(":").map(Number);
    const inicio = h * 60 + m;
    return inicio >= minutos && inicio <= hasta;
  }).slice(0, MAX_ENVIOS);

  if (aAvisar.length === 0) {
    return NextResponse.json({ ok: true, fecha, revisadas: filas.length, avisos: 0 });
  }

  // 4) A quién le mandamos: las suscripciones de esos socios.
  const idsSocios = [...new Set(aAvisar.map((r) => r.member_id))];
  const { data: subs } = await sb
    .from("push_subscriptions").select("id, member_id, endpoint, p256dh, auth")
    .in("member_id", idsSocios);
  const porSocio = new Map<string, Suscripcion[]>();
  ((subs as (Suscripcion & { member_id: string })[]) || []).forEach((s) => {
    const lista = porSocio.get(s.member_id) || [];
    lista.push({ id: s.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
    porSocio.set(s.member_id, lista);
  });

  // 5) El ícono del gimnasio, para que el aviso tenga su marca.
  const idsGyms = [...new Set(aAvisar.map((r) => r.gym_id))];
  const { data: gyms } = await sb.from("gyms").select("id, app_icon_url, logo_url").in("id", idsGyms);
  const iconoDe = new Map(
    ((gyms as { id: string; app_icon_url: string | null; logo_url: string | null }[]) || [])
      .map((g) => [g.id, g.app_icon_url || g.logo_url || null]),
  );

  let enviados = 0;
  let fallados = 0;
  const caducadas: string[] = [];
  const avisadas: string[] = [];
  // Para dejar rastro en `push_subscriptions`: sin esto no hay forma de saber
  // si los avisos estan llegando, que es exactamente la falla silenciosa que
  // queremos evitar.
  const anduvieron: string[] = [];
  const falladas: string[] = [];

  for (const r of aAvisar) {
    const clase = porClase.get(r.class_id);
    const lista = porSocio.get(r.member_id) || [];
    // Sin suscripciones no hay nada que mandar, pero igual la marcamos: si el
    // socio activa los avisos más tarde, no le llega el de una clase de hoy
    // que ya estaba por empezar.
    if (lista.length === 0) { avisadas.push(r.id); continue; }

    const hora = hhmm(clase?.start_time ?? null);
    const faltan = Math.max(0, Math.round(
      ((Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))) - minutos) / 60,
    ));
    const aviso = {
      titulo: `${(clase?.name || "Tu clase").trim()} a las ${hora}`,
      cuerpo: faltan <= 1 ? "Empieza en menos de una hora." : `Empieza en ${faltan} horas.`,
      url: "/portal?tab=clases",
      icono: clase?.image_url || iconoDe.get(r.gym_id) || null,
      // Una etiqueta por reserva: si por lo que sea se manda de nuevo, el aviso
      // se reemplaza en vez de apilarse en el teléfono.
      etiqueta: `clase-${r.id}`,
    };

    let alguno = false;
    for (const sub of lista) {
      const res = await enviarAviso(sub, aviso);
      if (res.ok) { enviados++; alguno = true; anduvieron.push(res.id); }
      else {
        fallados++;
        if (res.caduca) caducadas.push(res.id);
        else falladas.push(res.id);
      }
    }
    // Se marca aunque haya fallado en algún dispositivo: ya se intentó, y
    // reintentar en una hora sería avisar de una clase más cerca o ya empezada.
    if (alguno || lista.length > 0) avisadas.push(r.id);
  }

  // 6) Limpieza: los navegadores que ya no existen se sacan para no
  //    reintentarlos toda la vida.
  if (caducadas.length) {
    await sb.from("push_subscriptions").delete().in("id", caducadas);
  }
  if (anduvieron.length) {
    // Ultimo envio bueno, y el contador de fallos vuelve a cero.
    await sb.from("push_subscriptions")
      .update({ last_ok_at: new Date().toISOString(), fallos: 0 })
      .in("id", anduvieron);
  }
  for (const id of falladas) {
    // Fallo pasajero (no un 404/410): sumamos uno para poder ver cual esta
    // fallando siempre sin borrarla por un problema de un rato.
    const { data: actual } = await sb.from("push_subscriptions")
      .select("fallos").eq("id", id).maybeSingle<{ fallos: number }>();
    await sb.from("push_subscriptions")
      .update({ fallos: (actual?.fallos ?? 0) + 1 }).eq("id", id);
  }
  if (avisadas.length) {
    await sb.from("bookings").update({ aviso_clase_at: new Date().toISOString() }).in("id", avisadas);
  }

  return NextResponse.json({
    ok: true,
    fecha,
    revisadas: filas.length,
    candidatas: aAvisar.length,
    enviados,
    fallados,
    suscripciones_limpiadas: caducadas.length,
  });
}
