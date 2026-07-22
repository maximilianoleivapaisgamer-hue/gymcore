import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { scrapeGooglePlace } from "@/lib/apify";
import { searchGooglePlace } from "@/lib/google-places";

/**
 * Lee el perfil de un gimnasio para prellenar el generador de demos (solo super
 * admin). Puede usar Apify (scraping de Google Maps) o la API de Google Places,
 * según el proveedor elegido en Configuración. Los tokens salen de app_config
 * (que podés cambiar desde el panel) o, para Apify, de la variable de Vercel.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

async function getVal(admin: ReturnType<typeof createAdmin>, key: string): Promise<string> {
  const { data } = await admin.from("app_config").select("value").eq("key", key).maybeSingle<{ value: string }>();
  return (data?.value || "").trim();
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
  if (me?.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Solo el super admin puede usar esto." }, { status: 403 });
  }

  let body: { input?: string; url?: string; query?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const input = String(body.input || body.url || body.query || "").trim();
  if (!input) {
    return NextResponse.json({ ok: false, error: "Escribí nombre + ciudad, o pegá el link de Google Maps." }, { status: 400 });
  }

  // Config: token de Apify (base o Vercel), API key de Google y proveedor elegido.
  const [apifyDb, googleKey, providerRaw] = await Promise.all([
    getVal(admin, "apify_token"), getVal(admin, "google_places_key"), getVal(admin, "search_provider"),
  ]);
  const apifyToken = apifyDb || process.env.APIFY_TOKEN || "";
  const provider = providerRaw === "google" ? "google" : "apify";

  // Elegir con qué buscar: respeta el proveedor; si no hay credencial, cae al otro.
  let useGoogle: boolean;
  if (provider === "google") useGoogle = !!googleKey || !apifyToken;
  else useGoogle = !apifyToken && !!googleKey;

  if (useGoogle && !googleKey) {
    return NextResponse.json({ ok: false, error: "Elegiste Google pero falta la API key. Cargala en Configuración." }, { status: 400 });
  }
  if (!useGoogle && !apifyToken) {
    return NextResponse.json({ ok: false, error: "Falta el token de Apify. Cargalo en Configuración (o cambiá el proveedor a Google)." }, { status: 400 });
  }

  try {
    if (useGoogle) {
      const place = await searchGooglePlace(input, googleKey);
      if (!place) return NextResponse.json({ ok: false, error: "No encontré ese lugar en Google. Probá con el nombre + la ciudad." }, { status: 404 });
      // Contar la búsqueda de Google del mes (para el saldo estimado).
      const mk = `google_count_${new Date().toISOString().slice(0, 7)}`;
      const actual = Number(await getVal(admin, mk) || 0);
      await admin.from("app_config").upsert({ key: mk, value: String(actual + 1), updated_at: new Date().toISOString() }, { onConflict: "key" });
      return NextResponse.json({ ok: true, place, provider: "google" });
    }
    const place = await scrapeGooglePlace(input, apifyToken);
    if (!place) return NextResponse.json({ ok: false, error: "No encontré ese lugar. Probá escribiendo el nombre + la ciudad (ej: MegaCenter Gym San Miguel)." }, { status: 404 });
    return NextResponse.json({ ok: true, place, provider: "apify" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || "Falló la consulta al proveedor de búsqueda." }, { status: 502 });
  }
}
