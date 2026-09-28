import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { proyectar, ritmoReal } from "@/lib/proyeccion";
import { generarSimulacion, simulacionConfigurada, TEXTO_CONSENTIMIENTO } from "@/lib/simulacion";

/**
 * "Así podés llegar a estar en 3 y 6 meses."
 *
 *   GET  ?member_id=…  → qué se puede generar para este socio y qué ya tiene
 *   POST { member_id, meses, foto (base64), acepta }  → genera una
 *
 * ── El orden de los controles importa ───────────────────────────────────
 *
 * Se chequea, en este orden: que sea de su gimnasio, que el plan lo incluya,
 * que NO se haya pasado del tope del mes, que haya consentimiento, y recién ahí
 * se gasta plata llamando al modelo. Cada llamada a Gemini le cuesta a
 * turnogym, así que todo lo que puede fallar tiene que fallar antes.
 *
 * ⚠️ La proyección se calcula ACÁ, con los datos reales del socio, y se le pasa
 * al modelo como límite. Sin eso el modelo devuelve un cuerpo de revista: la
 * imagen sería inalcanzable y, peor, sería una promesa que el gimnasio no puede
 * cumplir. Ver lib/proyeccion.ts.
 */
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Tope de tamaño de la foto que manda el navegador. */
const MAX_FOTO_MB = 8;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
type Admin = NonNullable<ReturnType<typeof admin>>;

/**
 * Quién pide, de qué gimnasio y para quién puede generar.
 *
 * Hay dos caminos y sirven para momentos distintos:
 *
 *   EL GIMNASIO (dueño o empleado) → el momento de la VENTA. La persona está
 *     parada en el mostrador y todavía no tiene la app. Puede generar para
 *     cualquier socio SUYO.
 *
 *   EL SOCIO desde su app → la MOTIVACIÓN, y el camino que se comparte. Solo
 *     puede generar para sí mismo: el `member_id` sale de su sesión y se ignora
 *     lo que mande el pedido.
 */
async function quien(sb: Admin) {
  const { data: { user } } = await createServer().auth.getUser();
  if (!user) return { error: "No autenticado.", status: 401 as const };

  const { data: p } = await sb.from("profiles").select("id, role, gym_id").eq("id", user.id)
    .maybeSingle<{ id: string; role: string; gym_id: string | null }>();
  if (!p) return { error: "Tu cuenta no tiene perfil.", status: 403 as const };

  if (p.role === "member") {
    const { data: m } = await sb.from("members").select("id, gym_id")
      .eq("linked_user_id", user.id).maybeSingle<{ id: string; gym_id: string }>();
    if (!m) return { error: "Tu cuenta no está vinculada a un socio.", status: 403 as const };
    // `soloPara` es el candado: el socio no puede pedir la de otro.
    return { perfil: p, gymId: m.gym_id, soloPara: m.id };
  }

  if (!p.gym_id) return { error: "Tu cuenta no está vinculada a un gimnasio.", status: 403 as const };
  if (p.role !== "owner" && p.role !== "empleado" && p.role !== "super_admin") {
    return { error: "No tenés permiso para esto.", status: 403 as const };
  }
  return { perfil: p, gymId: p.gym_id, soloPara: null as string | null };
}

/**
 * Cuándo puede volver a generar ESTE socio, para este plazo.
 *
 * Existe porque ahora el socio puede generar desde su app: sin esto, uno
 * entusiasmado se lleva puesto el tope del mes del gimnasio él solo. Una cada
 * 30 días por plazo alcanza para tenerla y compartirla, y no la convierte en
 * un juguete.
 */
const DIAS_ENTRE_SIMULACIONES = 30;

async function puedeDeNuevo(sb: Admin, memberId: string, meses: number) {
  const desde = new Date(Date.now() - DIAS_ENTRE_SIMULACIONES * 86400000).toISOString();
  const { data } = await sb.from("member_simulaciones").select("created_at")
    .eq("member_id", memberId).eq("meses", meses).is("error", null)
    .gte("created_at", desde).order("created_at", { ascending: false }).limit(1);
  const ultima = (data || [])[0];
  if (!ultima) return { puede: true, dias: 0 };
  const dias = Math.ceil(
    (new Date(ultima.created_at).getTime() + DIAS_ENTRE_SIMULACIONES * 86400000 - Date.now()) / 86400000,
  );
  return { puede: false, dias: Math.max(1, dias) };
}

/** ¿El plan de este gimnasio incluye simulaciones? */
async function habilitado(sb: Admin, gymId: string): Promise<boolean> {
  const [{ data: sub }, { data: gym }] = await Promise.all([
    sb.from("subscriptions").select("plan").eq("gym_id", gymId).maybeSingle<{ plan: string }>(),
    sb.from("gyms").select("extra_features").eq("id", gymId)
      .maybeSingle<{ extra_features: string[] | null }>(),
  ]);
  if ((gym?.extra_features || []).includes("simulaciones")) return true;
  const { data: plan } = await sb.from("plan_configs").select("capabilities")
    .eq("key", sub?.plan || "basico").maybeSingle<{ capabilities: string[] | null }>();
  return (plan?.capabilities || []).includes("simulaciones");
}

/**
 * Cuántas lleva este mes y cuántas le quedan.
 *
 * El tope sale del gimnasio si tiene uno propio, y si no del general. Tiene que
 * ser por gimnasio porque un estudio de 20 socias y uno de 400 no necesitan lo
 * mismo, y quedarse sin cupo con un cliente adelante en el mostrador es mucho
 * peor que el costo de las imágenes.
 *
 * Los intentos fallidos no cuentan (`error is null`): que el modelo se haya
 * negado no es culpa del gimnasio.
 */
async function cupo(sb: Admin, gymId: string) {
  const desde = new Date();
  desde.setDate(1); desde.setHours(0, 0, 0, 0);
  const [{ count }, { data: sub }, { data: cfg }] = await Promise.all([
    sb.from("member_simulaciones").select("id", { count: "exact", head: true })
      .eq("gym_id", gymId).gte("created_at", desde.toISOString()).is("error", null),
    sb.from("subscriptions").select("simulaciones_por_mes").eq("gym_id", gymId)
      .maybeSingle<{ simulaciones_por_mes: number | null }>(),
    sb.from("platform_settings").select("simulaciones_por_mes").eq("id", 1)
      .maybeSingle<{ simulaciones_por_mes: number }>(),
  ]);
  const tope = sub?.simulaciones_por_mes ?? cfg?.simulaciones_por_mes ?? 100;
  return { usadas: count ?? 0, tope, quedan: Math.max(0, tope - (count ?? 0)) };
}

export async function GET(req: Request) {
  const sb = admin();
  if (!sb) return NextResponse.json({ ok: false, error: "Falta configuración." }, { status: 500 });
  const q = await quien(sb);
  if ("error" in q) return NextResponse.json({ ok: false, error: q.error }, { status: q.status });

  // El socio siempre ve las suyas; el gimnasio, las del socio que abrio.
  const memberId = q.soloPara || new URL(req.url).searchParams.get("member_id") || "";
  const [hab, c] = await Promise.all([habilitado(sb, q.gymId), cupo(sb, q.gymId)]);
  const espera = memberId
    ? { tres: await puedeDeNuevo(sb, memberId, 3), seis: await puedeDeNuevo(sb, memberId, 6) }
    : null;

  let hechas: unknown[] = [];
  if (memberId) {
    const { data } = await sb.from("member_simulaciones")
      .select("id, meses, foto_url, imagen_url, peso_desde, peso_hasta, enfoque, created_at")
      .eq("gym_id", q.gymId).eq("member_id", memberId).is("error", null)
      .order("created_at", { ascending: false });
    hechas = data || [];
  }

  // Lo que se va a sugerir, para poder mostrarlo antes de sacar la foto.
  let sugerencia = null;
  if (memberId) {
    const { data: m } = await sb.from("members").select("height_cm").eq("id", memberId)
      .maybeSingle<{ height_cm: number | null }>();
    const { data: w } = await sb.from("weight_logs").select("date, weight_kg")
      .eq("member_id", memberId).order("date", { ascending: false }).limit(12);
    const hist = (w as { date: string; weight_kg: number }[]) || [];
    if (m?.height_cm && hist[0]?.weight_kg) {
      const datos = { pesoKg: hist[0].weight_kg, alturaCm: m.height_cm, ritmoRealMensual: ritmoReal(hist) };
      const t3 = proyectar(datos, 3), t6 = proyectar(datos, 6);
      sugerencia = {
        peso: hist[0].weight_kg,
        tres: t3 && { kilos: Math.abs(t3.cambio), tope: t3.topeKilos, enfoque: t3.enfoque },
        seis: t6 && { kilos: Math.abs(t6.cambio), tope: t6.topeKilos, enfoque: t6.enfoque },
      };
    }
  }

  return NextResponse.json({
    ok: true,
    habilitado: hab,
    sugerencia,
    disponible: simulacionConfigurada(),
    consentimiento: TEXTO_CONSENTIMIENTO,
    es_socio: !!q.soloPara,
    member_id: memberId || null,
    espera,
    ...c,
    hechas,
  });
}

export async function POST(req: Request) {
  const sb = admin();
  if (!sb) return NextResponse.json({ ok: false, error: "Falta configuración." }, { status: 500 });
  const q = await quien(sb);
  if ("error" in q) return NextResponse.json({ ok: false, error: q.error }, { status: q.status });

  if (!simulacionConfigurada()) {
    return NextResponse.json({ ok: false, error: "El simulador todavía no está configurado." }, { status: 503 });
  }
  if (!(await habilitado(sb, q.gymId))) {
    return NextResponse.json({ ok: false, error: "El simulador está en los planes Pro y Elite." }, { status: 403 });
  }

  const c = await cupo(sb, q.gymId);
  if (c.quedan <= 0) {
    return NextResponse.json(
      { ok: false, error: `Llegaste a las ${c.tope} simulaciones de este mes. Se renueva el 1°.` },
      { status: 429 },
    );
  }

  let body: { member_id?: string; meses?: number; foto?: string; tipo?: string; acepta?: boolean; kilos?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 }); }

  // Sin consentimiento no se genera. Es una foto del cuerpo de una persona.
  if (body.acepta !== true) {
    return NextResponse.json({ ok: false, error: "Falta que la persona acepte." }, { status: 400 });
  }

  // Si pide un socio, el id sale de su sesion: se ignora lo que haya mandado.
  const memberId = q.soloPara || String(body.member_id || "").trim();
  const meses = Number(body.meses);
  if (!memberId || ![3, 6].includes(meses)) {
    return NextResponse.json({ ok: false, error: "Faltan datos." }, { status: 400 });
  }

  // El socio tiene que ser DE SU gimnasio.
  const { data: socio } = await sb.from("members")
    .select("id, gym_id, full_name, height_cm").eq("id", memberId)
    .maybeSingle<{ id: string; gym_id: string; full_name: string; height_cm: number | null }>();
  if (!socio || socio.gym_id !== q.gymId) {
    return NextResponse.json({ ok: false, error: "Ese socio no existe." }, { status: 404 });
  }

  const otraVez = await puedeDeNuevo(sb, memberId, meses);
  if (!otraVez.puede) {
    return NextResponse.json({
      ok: false,
      error: `Ya hay una simulación de ${meses} meses hecha hace poco. Se puede hacer otra en ${otraVez.dias} ${otraVez.dias === 1 ? "día" : "días"}.`,
    }, { status: 429 });
  }

  const foto = Buffer.from(String(body.foto || "").replace(/^data:[^,]+,/, ""), "base64");
  if (!foto.length) return NextResponse.json({ ok: false, error: "Falta la foto." }, { status: 400 });
  if (foto.length > MAX_FOTO_MB * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: `La foto no puede pesar más de ${MAX_FOTO_MB} MB.` }, { status: 400 });
  }

  // ── La proyección, con SUS números ──────────────────────────────────
  const { data: pesos } = await sb.from("weight_logs").select("date, weight_kg")
    .eq("member_id", memberId).order("date", { ascending: false }).limit(12);
  const historial = (pesos as { date: string; weight_kg: number }[]) || [];
  const pesoActual = historial[0]?.weight_kg;

  if (!pesoActual || !socio.height_cm) {
    return NextResponse.json({
      ok: false,
      error: "Para simular hace falta el peso y la altura del socio. Cargalos en su ficha y volvé a intentar.",
    }, { status: 400 });
  }

  // El entrenador puede cambiar los kilos: conoce a la persona mejor que
  // nosotros. `proyectar` lo acota al tope sano, asi que un numero de mas no
  // se convierte en una promesa imposible.
  const p = proyectar(
    { pesoKg: pesoActual, alturaCm: socio.height_cm, ritmoRealMensual: ritmoReal(historial) },
    meses,
    // El socio, desde su app, no elige los kilos: solo el gimnasio.
    q.soloPara ? null : (Number.isFinite(Number(body.kilos)) ? Number(body.kilos) : null),
  );
  if (!p) return NextResponse.json({ ok: false, error: "El peso o la altura cargados no parecen correctos." }, { status: 400 });

  // ── Recién acá se gasta plata ───────────────────────────────────────
  const r = await generarSimulacion(foto, body.tipo || "image/jpeg", p, meses);

  const base = `${q.gymId}/simulaciones/${memberId}-${Date.now()}`;
  const subir = await sb.storage.from("gym-assets")
    .upload(`${base}-original.jpg`, foto, { contentType: body.tipo || "image/jpeg", upsert: true });
  const fotoUrl = subir.error
    ? ""
    : sb.storage.from("gym-assets").getPublicUrl(`${base}-original.jpg`).data.publicUrl;

  if (!r.ok) {
    // Queda la fila con el motivo: sirve para ver si el modelo está fallando
    // seguido. No cuenta contra el tope (el cupo filtra `error is null`).
    await sb.from("member_simulaciones").insert({
      gym_id: q.gymId, member_id: memberId, foto_url: fotoUrl || "-", meses,
      consentimiento_texto: TEXTO_CONSENTIMIENTO, creado_por: q.perfil.id,
      peso_desde: p.pesoActual, peso_hasta: p.pesoObjetivo, enfoque: p.enfoque,
      error: r.error.slice(0, 500),
    });
    return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
  }

  const sube = await sb.storage.from("gym-assets")
    .upload(`${base}-${meses}m.jpg`, r.imagen, { contentType: "image/jpeg", upsert: true });
  if (sube.error) return NextResponse.json({ ok: false, error: "No pudimos guardar la imagen." }, { status: 500 });
  const imagenUrl = sb.storage.from("gym-assets").getPublicUrl(`${base}-${meses}m.jpg`).data.publicUrl;

  const { data: fila, error } = await sb.from("member_simulaciones").insert({
    gym_id: q.gymId, member_id: memberId, foto_url: fotoUrl, imagen_url: imagenUrl, meses,
    consentimiento_texto: TEXTO_CONSENTIMIENTO, creado_por: q.perfil.id,
    peso_desde: p.pesoActual, peso_hasta: p.pesoObjetivo, enfoque: p.enfoque,
  }).select("id").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    id: fila.id,
    imagen_url: imagenUrl,
    foto_url: fotoUrl,
    proyeccion: p,
    quedan: c.quedan - 1,
  });
}
