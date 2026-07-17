import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Token de Apify para el scraping de Google Maps (solo super admin).
 *  - get:   dice si hay un token guardado en la base y muestra los últimos 4
 *           dígitos (nunca el token completo). También si hay uno por Vercel.
 *  - set:   guarda un token nuevo (pisa el anterior). Sirve para rotarlo cuando
 *           se te acaban los créditos, sin tocar Vercel ni redeployar.
 *  - clear: borra el de la base y vuelve a usar el de Vercel (APIFY_TOKEN).
 * El token guardado en la base MANDA sobre el de Vercel.
 */
export const runtime = "nodejs";

const KEY = "apify_token";
function mask(t: string): string {
  const s = (t || "").trim();
  if (s.length <= 4) return "••••";
  return `••••${s.slice(-4)}`;
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  }

  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Solo el super admin." }, { status: 403 });
  }

  let body: { action?: string; token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const action = String(body.action || "get");

  async function estado() {
    const { data } = await admin.from("app_config").select("value, updated_at").eq("key", KEY).maybeSingle<{ value: string; updated_at: string }>();
    const dbTok = (data?.value || "").trim();
    return {
      hasDbToken: !!dbTok,
      dbMasked: dbTok ? mask(dbTok) : null,
      dbUpdatedAt: data?.updated_at || null,
      hasEnvToken: !!process.env.APIFY_TOKEN,
    };
  }

  if (action === "get") {
    return NextResponse.json({ ok: true, ...(await estado()) });
  }

  if (action === "set") {
    const token = String(body.token || "").trim();
    if (token.length < 20) {
      return NextResponse.json({ ok: false, error: "Ese token parece muy corto. Copiá el token completo de Apify." }, { status: 400 });
    }
    const { error } = await admin.from("app_config").upsert({ key: KEY, value: token, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await estado()) });
  }

  if (action === "clear") {
    const { error } = await admin.from("app_config").delete().eq("key", KEY);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await estado()) });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
