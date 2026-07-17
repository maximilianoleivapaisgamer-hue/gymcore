import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { ipHash } from "@/lib/client-ip";

/**
 * Registra una visita a la WEB de una demo (para saber si el prospecto la abrió).
 * Público (lo llama la página pública al cargar), pero solo cuenta si el gimnasio
 * es realmente una demo. Escribe con service role (RLS no deja insertar al cliente).
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ ok: true }); // sin backend, no rompemos la web

  let body: { gymId?: string; kind?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  const gymId = String(body.gymId || "").trim();
  const kind = ["web", "panel", "socio"].includes(String(body.kind)) ? String(body.kind) : "web";
  if (!gymId) return NextResponse.json({ ok: true });

  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { data: gym } = await admin.from("gyms").select("is_demo").eq("id", gymId).maybeSingle<{ is_demo: boolean }>();
    if (gym?.is_demo) {
      const h = ipHash(req);
      // ¿La IP es tuya (super admin)? Entonces el evento se marca como propio.
      let isOwner = false;
      if (h) {
        const { data: mine } = await admin.from("admin_ips").select("ip_hash").eq("ip_hash", h).maybeSingle();
        isOwner = !!mine;
      }
      await admin.from("demo_visits").insert({ gym_id: gymId, kind, ip_hash: h || null, is_owner: isOwner });
    }
  } catch { /* best-effort: nunca frenamos la web por esto */ }

  return NextResponse.json({ ok: true });
}
