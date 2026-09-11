import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { pushConfigurado } from "@/lib/push";

/**
 * Alta y baja de los avisos al celular.
 *
 *   POST   { endpoint, keys: { p256dh, auth } }  → se suscribe este navegador
 *   DELETE { endpoint }                          → se da de baja
 *
 * El socio sale de la SESIÓN, no del cuerpo del pedido: nadie puede suscribir
 * ni dar de baja a otro. La tabla tiene RLS sin políticas, así que solo se toca
 * desde acá, con el service role.
 *
 * Cada fila es UN NAVEGADOR: el mismo socio puede tener el celular y la compu.
 * Por eso el endpoint es único y al repetirse se pisa la fila vieja.
 */
export const runtime = "nodejs";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** El socio detrás de la sesión, o null si quien llama no es un socio. */
async function socioDe(sb: NonNullable<ReturnType<typeof admin>>, userId: string) {
  const { data } = await sb
    .from("members").select("id, gym_id").eq("linked_user_id", userId)
    .maybeSingle<{ id: string; gym_id: string }>();
  return data;
}

/** Dice si el servidor puede mandar avisos, para que la app no ofrezca algo roto. */
export async function GET() {
  return NextResponse.json({ ok: true, disponible: pushConfigurado() });
}

export async function POST(req: Request) {
  const sb = admin();
  if (!sb) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  if (!pushConfigurado()) {
    return NextResponse.json({ ok: false, error: "Los avisos todavía no están configurados." }, { status: 503 });
  }

  const { data: { user } } = await createServer().auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const socio = await socioDe(sb, user.id);
  if (!socio) return NextResponse.json({ ok: false, error: "Tu cuenta no está vinculada a un socio." }, { status: 403 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const endpoint = String(body.endpoint || "").trim();
  const p256dh = String(body.keys?.p256dh || "").trim();
  const auth = String(body.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "Faltan datos de la suscripción." }, { status: 400 });
  }

  // onConflict en endpoint: si el socio vuelve a activar los avisos en el mismo
  // teléfono, se actualiza la fila en vez de dejar duplicados que avisan dos veces.
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      gym_id: socio.gym_id,
      member_id: socio.id,
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      fallos: 0,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const sb = admin();
  if (!sb) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });

  const { data: { user } } = await createServer().auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  let body: { endpoint?: string } = {};
  try { body = await req.json(); } catch { /* sin endpoint damos de baja todo lo suyo */ }

  // El filtro por user_id es el que importa: aunque manden el endpoint de otro,
  // solo se borra lo propio.
  let q = sb.from("push_subscriptions").delete().eq("user_id", user.id);
  const endpoint = String(body.endpoint || "").trim();
  if (endpoint) q = q.eq("endpoint", endpoint);

  const { error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
