import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { generateDemoConfig } from "@/lib/ai/demo";
import { resolveLandingConfig, type LandingConfig } from "@/lib/landing-config";
import type { Gym } from "@/types/db";

/**
 * Gestión de una demo (solo super admin, solo is_demo):
 *  - suspender:   pausa/reactiva la web pública
 *  - actualizar:  edición rápida (nombre, frase, descripción, color)
 *  - regenerar:   vuelve a generar los textos con IA (mantiene marca, fotos y logins)
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }

  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Solo el super admin." }, { status: 403 });
  }

  let body: {
    action?: string; gymId?: string; suspended?: boolean;
    name?: string; tagline?: string; descripcion?: string; brandColor?: string; infoLibre?: string;
    direccion?: string; tipo?: string;
    heroUrl?: string; galeria?: { src: string; alt?: string }[];
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const gymId = String(body.gymId || "").trim();
  if (!gymId) return NextResponse.json({ ok: false, error: "Falta gymId." }, { status: 400 });

  const { data: gym } = await admin.from("gyms").select("*").eq("id", gymId).single<Gym>();
  if (!gym || !gym.is_demo) return NextResponse.json({ ok: false, error: "No es una demo válida." }, { status: 404 });

  // ---- Suspender / reactivar ----
  if (body.action === "suspender") {
    const { error } = await admin.from("gyms").update({ demo_suspended: !!body.suspended }).eq("id", gymId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, suspended: !!body.suspended });
  }

  // ---- Edición rápida ----
  if (body.action === "actualizar") {
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
    if (typeof body.tagline === "string") patch.tagline = body.tagline;
    if (typeof body.descripcion === "string") patch.description = body.descripcion;
    if (/^#[0-9a-fA-F]{6}$/.test(body.brandColor || "")) patch.accent_color = body.brandColor;
    // La dirección se guarda en la columna, que manda sobre la config al resolver
    // la landing (así el texto de la web coincide con el mapa).
    if (typeof body.direccion === "string" && body.direccion.trim()) patch.address = body.direccion.trim();
    // Tipo de negocio (gimnasio / personal): se guarda en la config de la landing.
    if (body.tipo === "gimnasio" || body.tipo === "personal") {
      const cfg = resolveLandingConfig(gym);
      cfg.tipo = body.tipo;
      patch.landing_config = cfg;
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: "Nada para actualizar." }, { status: 400 });
    const { error } = await admin.from("gyms").update(patch).eq("id", gymId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // ---- Cambiar imágenes (foto de fondo + galería) ----
  if (body.action === "imagenes") {
    const cfg: LandingConfig = resolveLandingConfig(gym);
    const patch: Record<string, unknown> = {};
    if (typeof body.heroUrl === "string" && body.heroUrl.trim()) {
      cfg.heroImagen = body.heroUrl.trim();
      patch.hero_url = body.heroUrl.trim();
    }
    if (Array.isArray(body.galeria)) {
      cfg.galeria = body.galeria
        .filter((g) => g && typeof g.src === "string" && g.src.trim())
        .slice(0, 12)
        .map((g) => ({ src: g.src.trim(), alt: typeof g.alt === "string" ? g.alt : "" }));
    }
    patch.landing_config = cfg;
    const { error } = await admin.from("gyms").update(patch).eq("id", gymId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, heroUrl: cfg.heroImagen, galeria: cfg.galeria });
  }

  // ---- Regenerar textos con IA (mantiene marca, fotos, logins) ----
  if (body.action === "regenerar") {
    const base: LandingConfig = resolveLandingConfig(gym);
    const ptSteer = base.tipo === "personal"
      ? "IMPORTANTE: Esto NO es un gimnasio, es un ENTRENADOR PERSONAL / personal trainer independiente. Escribí toda la web en primera persona como el entrenador, hablando de entrenamiento personalizado 1 a 1, planes a medida y seguimiento cercano. No uses 'socios', 'sala de musculación', 'instalaciones' ni 'clases grupales'. Las 'clases' son los servicios o modalidades (ej: Entrenamiento personalizado presencial, Plan online, Evaluación física, Entrenamiento a domicilio). Los 'planes' son sus paquetes (ej: 2 sesiones por semana, Plan online mensual). Los 'beneficios' son las ventajas de entrenar con un profesional dedicado."
      : "";
    let ai;
    try {
      ai = await generateDemoConfig({
        nombre: gym.name,
        ciudad: base.ubicacion.ciudad || gym.address || undefined,
        infoLibre: [ptSteer, body.infoLibre || `${gym.name}. ${base.descripcion}`].filter(Boolean).join("\n\n"),
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message || "La IA no pudo regenerar." }, { status: 502 });
    }
    const nueva: LandingConfig = {
      ...base,
      tagline: ai.tagline,
      descripcion: ai.descripcion,
      beneficios: ai.beneficios,
      clases: ai.clases,
      planes: ai.planes,
      ubicacion: { ...base.ubicacion, horarios: ai.ubicacion.horarios?.length ? ai.ubicacion.horarios : base.ubicacion.horarios },
    };
    const { error } = await admin.from("gyms").update({
      landing_config: nueva, tagline: ai.tagline, description: ai.descripcion,
    }).eq("id", gymId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
