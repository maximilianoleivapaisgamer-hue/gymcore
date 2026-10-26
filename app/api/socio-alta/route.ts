import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { contexto, esFallo } from "@/lib/panel";

/**
 * Crear el acceso del socio a la app.
 *
 *   POST { memberId }
 *
 * Usuario y contraseña son el DNI. El "usuario" es un email sintético
 * (dni@socios.gymcore.app) para que el socio simplemente escriba su DNI.
 *
 * ── Quién puede llamar ──────────────────────────────────────────────────
 *
 * ⚠️ Antes NO pedía nada: cualquiera con el UUID de un socio podía pegarle a
 * este endpoint y vincular esa ficha a una cuenta suya, o crear usuarios a
 * mano. Corre con la service role, que se saltea RLS entera, así que la
 * autorización tiene que estar acá adentro: no hay nada más abajo que la
 * frene. Ahora exige sesión, rol que pueda tocar socios, y que el socio sea
 * del MISMO gimnasio que quien pide.
 *
 * ⚠️ Los datos salen de la base por `memberId`, no del body. Si el DNI
 * viniera del navegador, alcanzaba con mandar otro para crearle el acceso a
 * una persona con el documento de otra.
 *
 * ── Por qué también sirve para socios viejos ────────────────────────────
 *
 * El alta automática solo corría al CREAR el socio y solo si en ese momento
 * tenía DNI. Al que se cargó sin DNI (y se lo pusieron después), o al que
 * entró por una importación, no se le creó nunca la cuenta, y desde el panel
 * no había forma de arreglarlo: la dueña veía al socio cargado y el socio no
 * podía entrar nunca. Pasó con una socia de DanzArte.
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el servidor. Nunca se expone al cliente.
 */
export const runtime = "nodejs";

const DNI_DOMAIN = "socios.gymcore.app";

/** Quién puede crearle el acceso a un socio. */
function puede(perfil: { role: string; permissions: string[] | null }): boolean {
  if (perfil.role === "owner" || perfil.role === "super_admin") return true;
  return perfil.role === "empleado" && (perfil.permissions || []).includes("socios");
}

interface Socio {
  id: string;
  gym_id: string;
  full_name: string | null;
  dni: string | null;
  email: string | null;
  linked_user_id: string | null;
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 500 },
    );
  }

  const ctx = await contexto(null);
  if (esFallo(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  const { sb, perfil } = ctx;
  if (!perfil.gym_id) return NextResponse.json({ ok: false, error: "Sin gimnasio." }, { status: 403 });
  if (!puede(perfil)) {
    return NextResponse.json({ ok: false, error: "No tenés permiso para dar de alta socios." }, { status: 403 });
  }

  let body: { memberId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 }); }

  const memberId = String(body?.memberId || "").trim();
  if (!memberId) return NextResponse.json({ ok: false, error: "Falta el socio." }, { status: 400 });

  // El filtro por gimnasio va a mano además de RLS: es la regla del proyecto,
  // y acá abajo se usa la service role, que RLS no mira.
  const { data: socio } = await sb
    .from("members").select("id, gym_id, full_name, dni, email, linked_user_id")
    .eq("id", memberId).eq("gym_id", perfil.gym_id).maybeSingle<Socio>();

  if (!socio) return NextResponse.json({ ok: false, error: "Ese socio no es de tu gimnasio." }, { status: 404 });
  if (socio.linked_user_id) {
    return NextResponse.json({ ok: true, userId: socio.linked_user_id, yaTenia: true });
  }

  const dni = String(socio.dni || "").replace(/\D/g, "");
  if (!dni) {
    return NextResponse.json(
      { ok: false, error: "Este socio no tiene DNI cargado, y el DNI es su usuario y su contraseña. Cargáselo y volvé a probar." },
      { status: 400 },
    );
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `${dni}@${DNI_DOMAIN}`;
  const fullName = socio.full_name || "";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: dni,
    email_confirm: true,
    user_metadata: { account_type: "member", full_name: fullName, dni, contact_email: socio.email || null },
  });

  let userId = created?.user?.id || null;

  // Ya existía una cuenta con ese DNI: se busca para vincularla igual.
  if (createErr) {
    const yaExiste = /already|registered|exists|duplicate/i.test(createErr.message || "");
    if (!yaExiste) return NextResponse.json({ ok: false, error: createErr.message }, { status: 400 });

    const { data: list } = await admin.auth.admin.listUsers();
    userId = list?.users?.find((u) => u.email === email)?.id || null;

    // ⚠️ Esa cuenta puede ser de un socio de OTRO gimnasio con el mismo DNI.
    // Vincularla sin más le daría la ficha de una persona a otra, y encima le
    // movería el gimnasio a la cuenta. Se corta y se avisa.
    if (userId) {
      const { data: ajeno } = await admin
        .from("members").select("id, gym_id").eq("linked_user_id", userId)
        .neq("gym_id", perfil.gym_id).limit(1).maybeSingle<{ id: string }>();
      if (ajeno) {
        return NextResponse.json({
          ok: false,
          error: "Ya existe una cuenta con ese DNI en otro gimnasio. Revisá que el DNI esté bien cargado.",
        }, { status: 409 });
      }
    }
  }

  if (!userId) {
    return NextResponse.json({ ok: false, error: "No se pudo crear la cuenta del socio." }, { status: 400 });
  }

  await admin
    .from("profiles")
    .upsert({ id: userId, role: "member", gym_id: perfil.gym_id, full_name: fullName }, { onConflict: "id" });

  await admin.from("members").update({ linked_user_id: userId }).eq("id", memberId);

  // El DNI vuelve para que la pantalla pueda decirle al dueño qué mandarle al
  // socio, sin que tenga que ir a buscarlo a la ficha.
  return NextResponse.json({ ok: true, userId, usuario: dni });
}
