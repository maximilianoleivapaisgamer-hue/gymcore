import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createPreapproval, createPreference, mpConfigured } from "@/lib/mercadopago";

/**
 * Checkout PÚBLICO de activación de una demo (sin login).
 * El prospecto que probó la demo entra a /activar/<slug>, paga, y su gimnasio
 * se activa solo (el webhook de MP convierte la demo en cliente real).
 *
 *  GET  ?slug=... → datos para pintar el checkout (gimnasio, planes, alias de
 *                   transferencia, si MP está configurado, y el acceso del dueño).
 *  POST { slug, plan, email } → crea la suscripción de Mercado Pago y devuelve
 *                   el link de pago (init_point).
 *
 * Solo funciona con gimnasios is_demo=true (nunca sobre un cliente real).
 * Requiere SUPABASE_SERVICE_ROLE_KEY (y MP_ACCESS_TOKEN para la parte de MP).
 */
export const runtime = "nodejs";

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadGym(slug: string) {
  const a = admin();
  const { data: gym } = await a.from("gyms")
    .select("id, name, slug, logo_url, owner_id, is_demo")
    .eq("slug", slug).maybeSingle<{ id: string; name: string; slug: string; logo_url: string | null; owner_id: string; is_demo: boolean }>();
  return { a, gym };
}

export async function GET(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  const slug = String(new URL(req.url).searchParams.get("slug") || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Falta el gimnasio." }, { status: 400 });

  const { a, gym } = await loadGym(slug);
  if (!gym) return NextResponse.json({ ok: false, error: "No existe ese gimnasio." }, { status: 404 });

  // Acceso del dueño (para mostrárselo tras activar). En las cuentas demo la
  // contraseña es igual al usuario (parte local del email).
  let ownerUser = "";
  try {
    const { data: u } = await a.auth.admin.getUserById(gym.owner_id);
    ownerUser = (u.user?.email || "").split("@")[0];
  } catch { /* ignore */ }

  const [{ data: planes }, { data: ps }] = await Promise.all([
    a.from("plan_configs").select("key, label, price, tagline, features").order("sort"),
    a.from("platform_settings").select("transfer_alias, transfer_cbu, transfer_holder, transfer_note, support_whatsapp").eq("id", 1).maybeSingle(),
  ]);

  return NextResponse.json({
    ok: true,
    gym: { name: gym.name, slug: gym.slug, logo: gym.logo_url },
    yaActivo: !gym.is_demo, // si ya es cliente real, no hay que volver a activar
    ownerUser,
    planes: planes || [],
    mp: mpConfigured(),
    transfer: {
      alias: ps?.transfer_alias || "",
      cbu: ps?.transfer_cbu || "",
      titular: ps?.transfer_holder || "",
      nota: ps?.transfer_note || "",
      whatsapp: ps?.support_whatsapp || "",
    },
  });
}

export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  if (!mpConfigured()) return NextResponse.json({ ok: false, error: "Mercado Pago todavía no está configurado. Probá por transferencia." }, { status: 503 });

  let body: { slug?: string; plan?: string; email?: string; metodo?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const plan = String(body.plan || "").trim();
  const email = String(body.email || "").trim();
  const metodo = body.metodo === "pago" ? "pago" : "suscripcion"; // suscripción (débito automático) o pago con MP
  if (!slug) return NextResponse.json({ ok: false, error: "Falta el gimnasio." }, { status: 400 });
  if (!["basico", "pro", "elite"].includes(plan)) return NextResponse.json({ ok: false, error: "Elegí un plan." }, { status: 400 });
  if (!email.includes("@")) return NextResponse.json({ ok: false, error: "Escribí un email válido para el pago." }, { status: 400 });

  const { a, gym } = await loadGym(slug);
  if (!gym) return NextResponse.json({ ok: false, error: "No existe ese gimnasio." }, { status: 404 });
  if (!gym.is_demo) return NextResponse.json({ ok: false, error: "Este gimnasio ya está activo." }, { status: 400 });

  const { data: planCfg } = await a.from("plan_configs").select("label, price").eq("key", plan).maybeSingle<{ label: string; price: number }>();
  const amount = Number(planCfg?.price) || 0;
  if (amount <= 0) return NextResponse.json({ ok: false, error: "Ese plan no tiene precio configurado." }, { status: 400 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  const backUrl = `${appUrl}/activar/${slug}/listo`;
  const notificationUrl = `${appUrl}/api/pagos/webhook`;
  const externalReference = `${gym.id}|${plan}`;
  // Mercado Pago limita el "reason" de la suscripción a 60 caracteres.
  const reason = `turnogym Plan ${planCfg?.label || plan} - ${gym.name}`.slice(0, 60);

  try {
    if (metodo === "pago") {
      // Pago con Mercado Pago (Checkout Pro, sin débito automático).
      const pref = await createPreference({
        title: reason,
        amount, payerEmail: email, backUrl, notificationUrl, externalReference,
      });
      return NextResponse.json({ ok: true, init_point: pref.init_point });
    }
    // Suscripción (débito automático mensual).
    const pre = await createPreapproval({
      reason,
      amount, payerEmail: email, backUrl, notificationUrl, externalReference,
    });
    await a.from("subscriptions").update({ mp_preapproval_id: pre.id }).eq("gym_id", gym.id);
    return NextResponse.json({ ok: true, init_point: pre.init_point });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
