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
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Falta APIFY_TOKEN en el servidor (cargalo en Vercel)." }, { status: 500 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Verificar super admin.
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  if (url && serviceKey) {
    const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
    if (me?.role !== "super_admin") {
      return NextResponse.json({ ok: false, error: "Solo el super admin puede usar esto." }, { status: 403 });
    }
  }

  let body: { url?: string; query?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const gUrl = String(body.url || "").trim();
  const query = String(body.query || "").trim();
  if (!gUrl && !query) {
    return NextResponse.json({ ok: false, error: "Pegá el link de Google Maps o escribí nombre + ciudad." }, { status: 400 });
  }

  try {
    const place = await scrapeGooglePlace({ url: gUrl || undefined, query: query || undefined }, token);
    if (!place) return NextResponse.json({ ok: false, error: "No encontré ese lugar en Google. Probá con el link directo de Maps." }, { status: 404 });
    return NextResponse.json({ ok: true, place });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Falló la consulta a Apify." }, { status: 502 });
  }
}
