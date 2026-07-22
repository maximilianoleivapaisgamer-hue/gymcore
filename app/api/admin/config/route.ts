import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { apifyUsage } from "@/lib/google-places";

/**
 * Configuración del super admin: tokens de búsqueda (Apify y Google Places),
 * proveedor activo y saldos. Todo se guarda en app_config (solo lo lee el
 * servidor). Acciones: get, reveal, set_apify, clear_apify, set_google,
 * clear_google, set_provider, balance.
 */
export const runtime = "nodejs";

const K_APIFY = "apify_token";
const K_GOOGLE = "google_places_key";
const K_PROVIDER = "search_provider";
const GOOGLE_EST_PER_SEARCH = 0.05; // USD aprox por búsqueda (Text Search + fotos)

function mask(t: string): string {
  const s = (t || "").trim();
  if (s.length <= 4) return "••••";
  return `••••${s.slice(-4)}`;
}
function monthKey() {
  return `google_count_${new Date().toISOString().slice(0, 7)}`; // google_count_YYYY-MM
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });

  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") return NextResponse.json({ ok: false, error: "Solo el super admin." }, { status: 403 });

  async function getVal(key: string): Promise<string> {
    const { data } = await admin.from("app_config").select("value").eq("key", key).maybeSingle<{ value: string }>();
    return (data?.value || "").trim();
  }
  async function setVal(key: string, value: string) {
    await admin.from("app_config").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }
  async function delVal(key: string) {
    await admin.from("app_config").delete().eq("key", key);
  }

  let body: { action?: string; token?: string; key?: string; provider?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const action = String(body.action || "get");

  async function estado() {
    const [apifyTok, googleKey, provider, count] = await Promise.all([
      getVal(K_APIFY), getVal(K_GOOGLE), getVal(K_PROVIDER), getVal(monthKey()),
    ]);
    return {
      apify: { hasToken: !!apifyTok, masked: apifyTok ? mask(apifyTok) : null, hasEnv: !!process.env.APIFY_TOKEN },
      google: { hasKey: !!googleKey, masked: googleKey ? mask(googleKey) : null },
      provider: provider === "google" ? "google" : "apify",
      googleCount: Number(count || 0),
      mes: new Date().toISOString().slice(0, 7),
    };
  }

  if (action === "get") return NextResponse.json({ ok: true, ...(await estado()) });

  if (action === "reveal") {
    const [apifyTok, googleKey] = await Promise.all([getVal(K_APIFY), getVal(K_GOOGLE)]);
    return NextResponse.json({ ok: true, apifyToken: apifyTok || null, googleKey: googleKey || null });
  }

  if (action === "set_apify") {
    const t = String(body.token || "").trim();
    if (t.length < 20) return NextResponse.json({ ok: false, error: "Ese token parece muy corto." }, { status: 400 });
    await setVal(K_APIFY, t);
    return NextResponse.json({ ok: true, ...(await estado()) });
  }
  if (action === "clear_apify") { await delVal(K_APIFY); return NextResponse.json({ ok: true, ...(await estado()) }); }

  if (action === "set_google") {
    const k = String(body.key || "").trim();
    if (k.length < 20) return NextResponse.json({ ok: false, error: "Esa API key parece muy corta." }, { status: 400 });
    await setVal(K_GOOGLE, k);
    return NextResponse.json({ ok: true, ...(await estado()) });
  }
  if (action === "clear_google") { await delVal(K_GOOGLE); return NextResponse.json({ ok: true, ...(await estado()) }); }

  if (action === "set_provider") {
    const p = body.provider === "google" ? "google" : "apify";
    await setVal(K_PROVIDER, p);
    return NextResponse.json({ ok: true, ...(await estado()) });
  }

  if (action === "balance") {
    const [apifyTok, googleKey, count] = await Promise.all([getVal(K_APIFY), getVal(K_GOOGLE), getVal(monthKey())]);
    const effectiveApify = apifyTok || process.env.APIFY_TOKEN || "";
    const apify = effectiveApify ? await apifyUsage(effectiveApify) : null;
    const apifyOut = apify
      ? {
          usedUsd: apify.usedUsd,
          limitUsd: apify.limitUsd,
          remainingUsd: apify.limitUsd != null && apify.usedUsd != null ? Math.max(0, apify.limitUsd - apify.usedUsd) : null,
        }
      : null;
    const gCount = Number(count || 0);
    return NextResponse.json({
      ok: true,
      apify: apifyOut,
      apifyReadable: !!effectiveApify,
      google: { hasKey: !!googleKey, count: gCount, estUsd: Math.round(gCount * GOOGLE_EST_PER_SEARCH * 100) / 100 },
      mes: new Date().toISOString().slice(0, 7),
    });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
