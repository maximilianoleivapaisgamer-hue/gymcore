import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { scrapeGooglePlace } from "@/lib/apify";

/**
 * Lee el perfil de Google Maps de un gimnasio con Apify (solo super admin).
 * Devuelve datos + fotos para prellenar el generador de demos.
 * Requiere APIFY_TOKEN en el servidor.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Verificar super admin.
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  // El token guardado en la base (que podés cambiar desde el panel cuando se te
  // acaban los créditos) MANDA sobre el de Vercel (APIFY_TOKEN).
  let token = process.env.APIFY_TOKEN || "";
  if (url && serviceKey) {
    const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
    if (me?.role !== "super_admin") {
      return NextResponse.json({ ok: false, error: "Solo el super admin puede usar esto." }, { status: 403 });
    }
    const { data: cfg } = await admin.from("app_config").select("value").eq("key", "apify_token").maybeSingle<{ value: string }>();
    if (cfg?.value && cfg.value.trim()) token = cfg.value.trim();
  }
  if (!token) {
    return NextResponse.json({ ok: false, error: "Falta el token de Apify. Cargalo en el panel de demos (⚙️ Token de Apify) o en Vercel." }, { status: 500 });
  }

  let body: { input?: string; url?: string; query?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const input = String(body.input || body.url || body.query || "").trim();
  if (!input) {
    return NextResponse.json({ ok: false, error: "Escribí nombre + ciudad, o pegá el link de Google Maps." }, { status: 400 });
  }

  try {
    const place = await scrapeGooglePlace(input, token);
    if (!place) return NextResponse.json({ ok: false, error: "No encontré ese lugar. Probá escribiendo el nombre + la ciudad (ej: MegaCenter Gym San Miguel)." }, { status: 404 });
    return NextResponse.json({ ok: true, place });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Falló la consulta a Apify." }, { status: 502 });
  }
}
