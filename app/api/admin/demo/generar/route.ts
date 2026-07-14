import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { generateDemoConfig } from "@/lib/ai/demo";
import { DEFAULT_LANDING, type LandingConfig } from "@/lib/landing-config";

/**
 * Genera un gimnasio DEMO con IA (solo super admin).
 * Crea la web branded + el usuario dueño (login del panel). El login del socio
 * y los datos de ejemplo se agregan en un paso aparte.
 *
 * Requiere ANTHROPIC_API_KEY y SUPABASE_SERVICE_ROLE_KEY en el servidor.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "gym";
}
function rand(n: number): string {
  const c = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

async function fetchWebText(url: string): Promise<string> {
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 turnogym-demo" } });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }

  // Verificar super admin.
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Solo el super admin puede generar demos." }, { status: 403 });
  }

  let body: {
    nombre?: string; instagram?: string; ciudad?: string; website?: string; infoLibre?: string;
    images?: { mediaType: string; data: string }[]; logoUrl?: string; heroUrl?: string;
    ownerEmail?: string; ownerPassword?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const nombre = String(body.nombre || "").trim();
  if (!nombre) return NextResponse.json({ ok: false, error: "Poné al menos el nombre del gimnasio." }, { status: 400 });

  // 1) IA: armar la config de la landing.
  const webTexto = body.website ? await fetchWebText(String(body.website)) : "";
  let ai;
  try {
    ai = await generateDemoConfig({
      nombre,
      instagram: body.instagram,
      ciudad: body.ciudad,
      webTexto,
      infoLibre: body.infoLibre,
      images: Array.isArray(body.images) ? body.images.slice(0, 4) : undefined,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "La IA no pudo generar la demo." }, { status: 502 });
  }

  // 2) Armar la LandingConfig completa.
  const logoUrl = body.logoUrl || null;
  const cfg: LandingConfig = {
    ...JSON.parse(JSON.stringify(DEFAULT_LANDING)),
    nombre,
    tagline: ai.tagline,
    descripcion: ai.descripcion,
    logoUrl,
    heroImagen: body.heroUrl || null,
    heroLogo: !!logoUrl,
    tituloColor: null,
    marca: { primary: ai.marca.primary, secondary: ai.marca.secondary, dark: ai.marca.dark },
    whatsapp: (ai.whatsapp || "").replace(/\D/g, ""),
    email: "",
    telefono: "",
    instagram: body.instagram || ai.instagram || "",
    facebook: "",
    tiktok: "",
    beneficios: ai.beneficios,
    clases: ai.clases,
    planes: ai.planes,
    galeria: [],
    ubicacion: ai.ubicacion,
    secciones: { beneficios: true, clases: true, planes: true, galeria: true },
  };

  // 3) Crear el usuario dueño de la demo (login del panel).
  const slug = `demo-${slugify(nombre)}-${rand(4)}`;
  const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase() || `${slug}@demo.turnogym.app`;
  const ownerPassword = String(body.ownerPassword || "") || `demo-${rand(6)}`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: { account_type: "owner", full_name: nombre, is_demo: true },
  });
  if (cErr || !created?.user?.id) {
    const already = /already|registered|exists|duplicate/i.test(cErr?.message || "");
    return NextResponse.json({ ok: false, error: already ? "Ese email de dueño ya existe. Probá otro." : (cErr?.message || "No se pudo crear el usuario dueño.") }, { status: 400 });
  }
  const ownerId = created.user.id;

  // 4) Crear el gimnasio demo.
  const { data: gym, error: gErr } = await admin.from("gyms").insert({
    owner_id: ownerId,
    name: nombre,
    slug,
    is_demo: true,
    accent_color: cfg.marca.primary,
    logo_url: logoUrl,
    hero_url: cfg.heroImagen,
    theme: "celeste",
    bg_style: "aurora",
    tagline: cfg.tagline,
    description: cfg.descripcion,
    whatsapp: cfg.whatsapp,
    address: cfg.ubicacion.direccion,
    instagram: cfg.instagram,
    landing_config: cfg,
  }).select("id, slug").single<{ id: string; slug: string }>();
  if (gErr || !gym) {
    await admin.auth.admin.deleteUser(ownerId).catch(() => {});
    return NextResponse.json({ ok: false, error: gErr?.message || "No se pudo crear el gimnasio demo." }, { status: 400 });
  }

  // 5) Perfil del dueño + suscripción Elite (todo desbloqueado) + sede principal.
  await admin.from("profiles").upsert({ id: ownerId, role: "owner", gym_id: gym.id, full_name: nombre }, { onConflict: "id" });
  await admin.from("subscriptions").upsert({ gym_id: gym.id, plan: "elite", status: "active" }, { onConflict: "gym_id" });
  await admin.from("sedes").insert({ gym_id: gym.id, name: "Sede principal" });

  return NextResponse.json({
    ok: true,
    slug: gym.slug,
    url: `/${gym.slug}`,
    owner: { email: ownerEmail, password: ownerPassword },
  });
}
