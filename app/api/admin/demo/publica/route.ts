import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Cuál demo usa el botón genérico "Probar" de la web (turnogym.com/demo) para el
 * auto-login sin clave. Se guarda en app_config.public_demo_slug (solo super admin).
 *  - get:   { slug }
 *  - set:   { slug }  marca esa demo como la pública
 *  - clear: la desmarca
 */
export const runtime = "nodejs";
const KEY = "public_demo_slug";

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

  let body: { action?: string; slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const action = String(body.action || "get");

  async function current(): Promise<string> {
    const { data } = await admin.from("app_config").select("value").eq("key", KEY).maybeSingle<{ value: string }>();
    return (data?.value || "").trim();
  }

  if (action === "get") return NextResponse.json({ ok: true, slug: await current() });

  if (action === "set") {
    const slug = String(body.slug || "").trim();
    if (!slug) return NextResponse.json({ ok: false, error: "Falta el slug." }, { status: 400 });
    // Confirmar que es una demo real antes de publicarla.
    const { data: gym } = await admin.from("gyms").select("id, is_demo").eq("slug", slug).maybeSingle<{ id: string; is_demo: boolean }>();
    if (!gym || !gym.is_demo) return NextResponse.json({ ok: false, error: "Ese gimnasio no es una demo." }, { status: 400 });
    await admin.from("app_config").upsert({ key: KEY, value: slug, updated_at: new Date().toISOString() }, { onConflict: "key" });
    return NextResponse.json({ ok: true, slug });
  }

  if (action === "clear") {
    await admin.from("app_config").delete().eq("key", KEY);
    return NextResponse.json({ ok: true, slug: "" });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
