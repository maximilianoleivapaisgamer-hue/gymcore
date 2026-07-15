import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { mpConfigured } from "@/lib/mercadopago";

/**
 * Ajustes de cobro del SaaS (solo super admin):
 *  GET  → { mp, appUrl, settings }  (estado de Mercado Pago + datos de transferencia)
 *  POST → guarda transfer_alias/cbu/holder/note y convert_clear_sample.
 */
export const runtime = "nodejs";

async function guard() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.", status: 500 as const };
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { error: "No autenticado.", status: 401 as const };
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") return { error: "Solo el super admin.", status: 403 as const };
  return { admin };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { data: settings } = await g.admin.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  return NextResponse.json({
    ok: true,
    mp: mpConfigured(),
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    settings: settings || null,
  });
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  let body: {
    transfer_alias?: string; transfer_cbu?: string; transfer_holder?: string;
    transfer_note?: string; convert_clear_sample?: boolean;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const patch: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
  if (typeof body.transfer_alias === "string") patch.transfer_alias = body.transfer_alias.trim() || null;
  if (typeof body.transfer_cbu === "string") patch.transfer_cbu = body.transfer_cbu.trim() || null;
  if (typeof body.transfer_holder === "string") patch.transfer_holder = body.transfer_holder.trim() || null;
  if (typeof body.transfer_note === "string") patch.transfer_note = body.transfer_note.trim() || null;
  if (typeof body.convert_clear_sample === "boolean") patch.convert_clear_sample = body.convert_clear_sample;

  const { error } = await g.admin.from("platform_settings").upsert(patch, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
