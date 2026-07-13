import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Alta automática del socio como usuario de la app.
 * Cuando el gimnasio da de alta a un socio, se crea su cuenta para que pueda
 * entrar al portal: usuario y contraseña = su DNI. El "usuario" es un email
 * sintético armado con el DNI (dni@socios.gymcore.app) para que el socio
 * simplemente escriba su DNI en el login. Se lo vincula al member y se le deja
 * un profile con rol "member".
 *
 * Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY en el servidor
 * (Supabase → Project Settings → API → service_role). Nunca se expone al cliente.
 */
export const runtime = "nodejs";

const DNI_DOMAIN = "socios.gymcore.app";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 500 }
    );
  }

  let body: {
    dni?: string;
    memberId?: string;
    gymId?: string;
    fullName?: string;
    email?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const dni = String(body?.dni || "").trim();
  const memberId = String(body?.memberId || "").trim();
  const gymId = String(body?.gymId || "").trim();
  const fullName = String(body?.fullName || "").trim();
  const contactEmail = body?.email ? String(body.email).trim() : null;

  if (!dni || !memberId) {
    return NextResponse.json({ ok: false, error: "Faltan datos (dni/memberId)." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `${dni}@${DNI_DOMAIN}`;

  // Crear el usuario del socio (usuario y contraseña = DNI).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: dni,
    email_confirm: true,
    user_metadata: { account_type: "member", full_name: fullName, dni, contact_email: contactEmail },
  });

  let userId = created?.user?.id || null;

  // Si el socio ya tenía cuenta (mismo DNI), lo ubicamos para vincularlo igual.
  if (createErr) {
    const already = /already|registered|exists|duplicate/i.test(createErr.message || "");
    if (!already) {
      return NextResponse.json({ ok: false, error: createErr.message }, { status: 400 });
    }
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list?.users?.find((u) => u.email === email)?.id || null;
  }

  if (!userId) {
    return NextResponse.json({ ok: false, error: "No se pudo crear o ubicar el usuario." }, { status: 400 });
  }

  // Profile con rol "member" (garantiza el redirect al portal tras el login).
  await admin
    .from("profiles")
    .upsert({ id: userId, role: "member", gym_id: gymId || null, full_name: fullName }, { onConflict: "id" });

  // Vincular al member para que el portal encuentre la ficha del socio.
  await admin.from("members").update({ linked_user_id: userId }).eq("id", memberId);

  return NextResponse.json({ ok: true, userId });
}
