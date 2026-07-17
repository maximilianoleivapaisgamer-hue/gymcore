import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { ipHash } from "@/lib/client-ip";

/**
 * Registra la IP (hasheada) del super admin como "propia", para que los eventos
 * de las demos que vengan de esa IP no cuenten como prospecto. Se llama al entrar
 * al panel de admin.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ ok: true });

  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") return NextResponse.json({ ok: false }, { status: 403 });

  const h = ipHash(req);
  if (h) await admin.from("admin_ips").upsert({ ip_hash: h, seen_at: new Date().toISOString() }, { onConflict: "ip_hash" }).then(() => {}, () => {});
  return NextResponse.json({ ok: true });
}
