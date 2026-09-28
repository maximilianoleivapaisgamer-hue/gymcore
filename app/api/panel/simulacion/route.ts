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

/** Quién pide y de qué gimnasio. El socio NO puede generar: solo el negocio. */
async function quien(sb: Admin) {
  const { data: { user } } = await createServer().auth.getUser();
  if (!user) return { error: "No autenticado.", status: 401 as const };
  const { data: p } = await sb.from("profiles").select("id, role, gym_id").eq("id", user.id)
    .maybeSingle<{ id: string; role: string; gym_id: string | null }>();
  if (!p?.gym_id) return { error: "Tu cuenta no está vinculada a un gimnasio.", status: 403 as const };
  if (p.role !== "owner" && p.role !== "empleado" && p.role !== "super_admin") {
    return { error: "Esto lo hace el gimnasio, no el socio.", status: 403 as const };
  }
  return { perfil: p, gymId: p.gym_id };
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

/** Cuántas lleva este mes y cuántas le quedan. */
async function cupo(sb: Admin, gymId: string) {
  const desde = new Date();
  desde.setDate(1); desde.setHours(0, 0, 0, 0);
  const [{ count }, { data: cfg }] = await Promise.all([
    sb.from("member_simulaciones").select("id", { count: "exact", head: true })
      .eq("gym_id", gymId).gte("created_at", desde.toISOString()).is("error", null),
    sb.from("platform_settings").select("simulaciones_por_mes").eq("id", 1)
      .maybeSingle<{ simulaciones_por_mes: number }>(),
  ]);
  const tope = cfg?.simulaciones_por_mes ?? 30;
  return { usadas: count ?? 0, tope, quedan: Math.max(0, tope - (count ?? 0)) };
}

export async function GET(req: Request) {
  const sb = admin();
  if (!sb) return NextResponse.json({ ok: false, error: "Falta configuración." }, { status: 500 });
  const q = await quien(sb);
  if ("error" in q) return NextResponse.json({ ok: false, error: q.error }, { status: q.status });

  const memberId = new URL(req.url).searchParams.get("member_id") || "";
  const [hab, c] = await Promise.all([habilitado(sb, q.gymId), cupo(sb, q.gymId)]);

  let hechas: unknown[] = [];
  if (memberId) {
    const { data } = await sb.from("member_simulaciones")
      .select("id, meses, foto_url, imagen_url, peso_desde, peso_hasta, enfoque, created_at")
      .eq("gym_id", q.gymId).eq("member_id", memberId).is("error", null)
      .order("created_at", { ascending: false });
    hechas = data || [];
  }

  return NextResponse.json({
    ok: true,
    habilitado: hab,
    disponible: simulacionConfigurada(),
    consentimiento: TEXTO_CONSENTIMIENTO,
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

  let body: { member_id?: string; meses?: number; foto?: string; tipo?: string; acepta?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 }); }

  // Sin consentimiento no se genera. Es una foto del cuerpo de una persona.
  if (body.acepta !== true) {
    return NextResponse.json({ ok: false, error: "Falta que la persona acepte." }, { status: 400 });
  }

  const memberId = String(body.member_id || "").trim();
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

  const p = proyectar(
    { pesoKg: pesoActual, alturaCm: socio.height_cm, ritmoRealMensual: ritmoReal(historial) },
    meses,
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
