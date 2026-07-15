import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { generateDemoConfig } from "@/lib/ai/demo";
import { DEFAULT_LANDING, type LandingConfig } from "@/lib/landing-config";
import { seedDemoGym } from "@/lib/demo-seed";
import { STOCK_GYM } from "@/lib/stock-images";

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

/** Baja imágenes (ej: fotos de Google) y las sube al bucket para la galería. */
async function importGallery(
  admin: ReturnType<typeof createAdmin>,
  urls: string[]
): Promise<{ src: string; alt: string }[]> {
  const out: { src: string; alt: string }[] = [];
  for (const u of urls.slice(0, 12)) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") || "image/jpeg";
      if (!ct.startsWith("image/")) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const path = `demos/gallery/${crypto.randomUUID()}.${ext}`;
      const { error } = await admin.storage.from("gym-assets").upload(path, buf, { contentType: ct, upsert: true });
      if (error) continue;
      const { data } = admin.storage.from("gym-assets").getPublicUrl(path);
      out.push({ src: data.publicUrl, alt: "" });
    } catch {
      /* siguiente */
    }
  }
  return out;
}

/** Crea UN socio demo con login propio (DNI = usuario y contraseña), vinculado
 *  a la primera ficha (que ya tiene rutina y dieta cargadas). */
async function createDemoSocio(
  admin: ReturnType<typeof createAdmin>,
  gymId: string
): Promise<{ dni: string; name: string } | null> {
  const { data: mem } = await admin.from("members")
    .select("id, full_name").eq("gym_id", gymId)
    .order("created_at", { ascending: true }).limit(1).maybeSingle<{ id: string; full_name: string }>();
  if (!mem) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const dni = String(Math.floor(10000000 + Math.random() * 89999999));
    const email = `${dni}@socios.gymcore.app`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password: dni, email_confirm: true,
      user_metadata: { account_type: "member", full_name: mem.full_name, dni, is_demo: true },
    });
    if (error) {
      if (/already|exists|duplicate|registered/i.test(error.message || "")) continue;
      return null;
    }
    const userId = created?.user?.id;
    if (!userId) return null;
    await admin.from("profiles").upsert({ id: userId, role: "member", gym_id: gymId, full_name: mem.full_name }, { onConflict: "id" });
    await admin.from("members").update({ dni, linked_user_id: userId, height_cm: 172 }).eq("id", mem.id);

    // 10 registros de peso (para que ande el gráfico), con tendencia descendente.
    const weights: Record<string, unknown>[] = [];
    let w = 84;
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      weights.push({ gym_id: gymId, member_id: mem.id, date: iso, weight_kg: Math.round(w * 10) / 10 });
      w -= 0.4 + Math.random() * 0.5;
    }
    await admin.from("weight_logs").insert(weights).then(() => {}, () => {});

    return { dni, name: mem.full_name };
  }
  return null;
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

  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Autorización: dos vías.
  //  1) Token de bot (máquina-a-máquina): header 'x-bot-token' o 'Authorization: Bearer'.
  //     Sirve para que el robot de ventas genere demos solo, sin sesión.
  //  2) Sesión de super admin (cuando lo generás vos desde el panel).
  const botToken = process.env.DEMO_BOT_TOKEN;
  const authHeader = req.headers.get("authorization") || "";
  const given = req.headers.get("x-bot-token") || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "");
  const botOk = !!botToken && given.length >= 16 && given === botToken;

  if (!botOk) {
    const supa = createServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
    if (me?.role !== "super_admin") {
      return NextResponse.json({ ok: false, error: "Solo el super admin puede generar demos." }, { status: 403 });
    }
  }

  let body: {
    nombre?: string; instagram?: string; ciudad?: string; website?: string; infoLibre?: string;
    images?: { mediaType: string; data: string }[]; logoUrl?: string; heroUrl?: string;
    galleryUrls?: string[]; brandColor?: string; heroPick?: string;
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
      images: Array.isArray(body.images) ? body.images.slice(0, 10) : undefined,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "La IA no pudo generar la demo." }, { status: 502 });
  }

  // 2) Bajar las fotos a la galería (máx 5 en las demos). Si no eligieron
  //    ninguna, usamos fotos de ejemplo para que la landing no quede vacía.
  let urls = (Array.isArray(body.galleryUrls) && body.galleryUrls.length
    ? body.galleryUrls
    : STOCK_GYM).slice(0, 5);
  // Si eligieron una foto para el fondo, la ponemos primera (será el hero).
  if (body.heroPick && urls.includes(body.heroPick)) {
    urls = [body.heroPick, ...urls.filter((u) => u !== body.heroPick)].slice(0, 5);
  }
  const galeria = await importGallery(admin, urls);

  // 3) Armar la LandingConfig completa.
  const logoUrl = body.logoUrl || null;
  // Fondo del hero: el que subieron, o la primera foto (de Google) para que se
  // vea el gimnasio detrás del título.
  const heroImagen = body.heroUrl || galeria[0]?.src || null;
  const cfg: LandingConfig = {
    ...JSON.parse(JSON.stringify(DEFAULT_LANDING)),
    nombre,
    tagline: ai.tagline,
    descripcion: ai.descripcion,
    logoUrl,
    heroImagen,
    heroLogo: !!logoUrl,
    tituloColor: null,
    // El color de marca real (detectado del logo/perfil) manda sobre lo que adivine la IA.
    marca: {
      primary: /^#[0-9a-fA-F]{6}$/.test(body.brandColor || "") ? (body.brandColor as string) : ai.marca.primary,
      secondary: ai.marca.secondary,
      dark: ai.marca.dark,
    },
    whatsapp: (ai.whatsapp || "").replace(/\D/g, ""),
    email: "",
    telefono: "",
    instagram: body.instagram || ai.instagram || "",
    facebook: "",
    tiktok: "",
    beneficios: ai.beneficios,
    clases: ai.clases,
    planes: ai.planes,
    galeria,
    ubicacion: ai.ubicacion,
    secciones: { beneficios: true, clases: true, planes: true, galeria: true },
  };

  // 4) Usuario dueño (login del panel). Usuario = nombre del gym todo junto;
  //    la contraseña es la misma. Entra en /acceso escribiendo ese usuario.
  const slug = `demo-${slugify(nombre)}-${rand(4)}`;
  let ownerUser = slugify(nombre).replace(/-/g, "").slice(0, 24) || "demo";
  if (ownerUser.length < 6) ownerUser = (ownerUser + "000000").slice(0, 6);
  const userBase = ownerUser;
  let ownerId = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const email = `${ownerUser}@socios.gymcore.app`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password: ownerUser, email_confirm: true,
      user_metadata: { account_type: "owner", full_name: nombre, is_demo: true },
    });
    if (!cErr && created?.user?.id) { ownerId = created.user.id; break; }
    if (cErr && /already|exists|duplicate|registered/i.test(cErr.message || "")) { ownerUser = `${userBase}${attempt + 2}`; continue; }
    return NextResponse.json({ ok: false, error: cErr?.message || "No se pudo crear el usuario dueño." }, { status: 400 });
  }
  if (!ownerId) return NextResponse.json({ ok: false, error: "No se pudo crear el usuario dueño (probá otro nombre)." }, { status: 400 });

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
  const { data: sede } = await admin.from("sedes").insert({ gym_id: gym.id, name: "Sede principal" }).select("id").single<{ id: string }>();

  // 6) Datos de ejemplo (10 socios con rutinas, dietas, clases, caja).
  await seedDemoGym(admin, gym.id, sede?.id ?? null);

  // 7) Login de socio demo (para ver la app del cliente).
  const socio = await createDemoSocio(admin, gym.id).catch(() => null);

  // Base absoluta para que quien llame (ej: el bot) reciba links completos.
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");

  return NextResponse.json({
    ok: true,
    slug: gym.slug,
    url: `/${gym.slug}`,
    owner: { user: ownerUser, loginUrl: "/acceso" },
    socio: socio ? { name: socio.name, user: socio.dni, loginUrl: `/g/${gym.slug}` } : null,
    // Todo listo y absoluto (para bots / envíos automáticos):
    links: {
      web: `${base}/${gym.slug}`,
      ownerPanel: `${base}/acceso`,
      ownerUser: ownerUser,
      socioApp: socio ? `${base}/g/${gym.slug}` : null,
      socioUser: socio ? socio.dni : null,
    },
  });
}
