import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";

/**
 * Eliminar mi propia cuenta, desde adentro de la app.
 *
 * Las dos tiendas lo exigen para cualquier app donde te podés registrar (Apple
 * desde 2022, Google desde 2024), y es el rechazo más común. Además es un
 * derecho por la ley 25.326.
 *
 *   GET  → qué se va a borrar, para mostrárselo ANTES de que confirme.
 *   POST → lo borra.
 *
 * SIEMPRE borra la cuenta de QUIEN LLAMA. No recibe ningún id por parámetro:
 * el usuario sale de la sesión, así nadie puede borrar la cuenta de otro.
 *
 * Hay tres casos, y se resuelven por lo que la persona ES, no por lo que diga:
 *
 *  - DUEÑO   → se borra el gimnasio entero y todo lo que cuelga de él, más las
 *              cuentas de acceso de sus socios. Pide escribir el nombre del
 *              negocio para confirmar.
 *  - SOCIO   → se borra su ficha y su acceso. Sus reservas, peso, rutinas y
 *              dietas cascadean; los COBROS y las ASISTENCIAS quedan en el
 *              gimnasio con el socio en blanco (los FK son SET NULL), para no
 *              romperle la contabilidad a un negocio que no pidió nada.
 *  - EMPLEADO→ se borra su perfil y su acceso. El gimnasio no se toca.
 *
 * Al super admin no se lo deja borrar desde acá: sería tirar la plataforma.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

type Caso = "dueno" | "socio" | "empleado" | "suelto";

/** El cliente con service role, tipado desde el valor real que construimos. */
type Admin = NonNullable<ReturnType<typeof clientes>>;

interface Quien {
  userId: string;
  caso: Caso;
  gymId: string | null;
  gymNombre: string | null;
  memberId: string | null;
}

/** Averigua qué es esta persona. Todo contra la base, nada del cliente. */
async function quienEs(
  admin: Admin,
  userId: string,
): Promise<Quien | { error: string; status: number }> {
  const { data: perfil } = await admin
    .from("profiles").select("role, gym_id").eq("id", userId)
    .maybeSingle<{ role: string; gym_id: string | null }>();

  if (perfil?.role === "super_admin") {
    return { error: "La cuenta de administrador de la plataforma no se elimina desde acá.", status: 403 };
  }

  // ¿Es dueño de algún gimnasio? Se pregunta por owner_id, no por el rol:
  // el rol se puede haber quedado viejo, el dueño de la fila no.
  const { data: gym } = await admin
    .from("gyms").select("id, name").eq("owner_id", userId)
    .maybeSingle<{ id: string; name: string }>();
  if (gym) {
    return { userId, caso: "dueno", gymId: gym.id, gymNombre: gym.name, memberId: null };
  }

  const { data: socio } = await admin
    .from("members").select("id, gym_id").eq("linked_user_id", userId)
    .maybeSingle<{ id: string; gym_id: string }>();
  if (socio) {
    return { userId, caso: "socio", gymId: socio.gym_id, gymNombre: null, memberId: socio.id };
  }

  if (perfil?.gym_id) {
    return { userId, caso: "empleado", gymId: perfil.gym_id, gymNombre: null, memberId: null };
  }
  return { userId, caso: "suelto", gymId: null, gymNombre: null, memberId: null };
}

function clientes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** GET: el resumen de lo que se pierde, para mostrarlo antes de confirmar. */
export async function GET() {
  const admin = clientes();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  }
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const yo = await quienEs(admin, user.id);
  if ("error" in yo) return NextResponse.json({ ok: false, error: yo.error }, { status: yo.status });

  const contar = async (tabla: string, col: string, val: string) => {
    const { count } = await admin.from(tabla).select("id", { count: "exact", head: true }).eq(col, val);
    return count ?? 0;
  };

  if (yo.caso === "dueno" && yo.gymId) {
    const [socios, clases, reservas, movimientos] = await Promise.all([
      contar("members", "gym_id", yo.gymId),
      contar("classes", "gym_id", yo.gymId),
      contar("bookings", "gym_id", yo.gymId),
      contar("cashflow_entries", "gym_id", yo.gymId),
    ]);
    return NextResponse.json({
      ok: true, caso: yo.caso, gimnasio: yo.gymNombre,
      seBorra: { socios, clases, reservas, movimientos },
    });
  }

  if (yo.caso === "socio" && yo.memberId) {
    const [reservas, pesos, rutinas] = await Promise.all([
      contar("bookings", "member_id", yo.memberId),
      contar("weight_logs", "member_id", yo.memberId),
      contar("routines", "member_id", yo.memberId),
    ]);
    return NextResponse.json({ ok: true, caso: yo.caso, seBorra: { reservas, pesos, rutinas } });
  }

  return NextResponse.json({ ok: true, caso: yo.caso, seBorra: {} });
}

/** POST: elimina de verdad. */
export async function POST(req: Request) {
  const admin = clientes();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });
  }
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const yo = await quienEs(admin, user.id);
  if ("error" in yo) return NextResponse.json({ ok: false, error: yo.error }, { status: yo.status });

  let body: { confirmacion?: string } = {};
  try { body = await req.json(); } catch { /* el socio no manda nada */ }

  // ── Dueño: se lleva el gimnasio entero ────────────────────────────────
  if (yo.caso === "dueno" && yo.gymId) {
    const escrito = String(body.confirmacion || "").trim().toLowerCase();
    const esperado = String(yo.gymNombre || "").trim().toLowerCase();
    if (!esperado || escrito !== esperado) {
      return NextResponse.json(
        { ok: false, error: `Para confirmar, escribí el nombre de tu negocio tal cual: ${yo.gymNombre}` },
        { status: 400 },
      );
    }

    // Las cuentas de acceso de sus socios hay que juntarlas ANTES de borrar
    // el gimnasio: después la tabla members ya no existe.
    const { data: socios } = await admin
      .from("members").select("linked_user_id").eq("gym_id", yo.gymId).not("linked_user_id", "is", null);
    const cuentas = new Set<string>([user.id]);
    (socios as { linked_user_id: string | null }[] | null)?.forEach((s) => {
      if (s.linked_user_id) cuentas.add(s.linked_user_id);
    });

    const { error } = await admin.from("gyms").delete().eq("id", yo.gymId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    // Nunca borrar a un super admin, aunque figure como socio de este gimnasio.
    const ids = [...cuentas];
    const { data: admins } = await admin.from("profiles").select("id").in("id", ids).eq("role", "super_admin");
    const protegidos = new Set((admins as { id: string }[] | null)?.map((a) => a.id) || []);
    for (const id of ids) {
      if (protegidos.has(id)) continue;
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
    return NextResponse.json({ ok: true, caso: "dueno" });
  }

  // ── Socio: su ficha y su acceso. La plata del gimnasio queda. ─────────
  if (yo.caso === "socio" && yo.memberId) {
    const { error } = await admin.from("members").delete().eq("id", yo.memberId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
    return NextResponse.json({ ok: true, caso: "socio" });
  }

  // ── Empleado o cuenta suelta: solo su perfil y su acceso. ─────────────
  await admin.from("profiles").delete().eq("id", user.id);
  await admin.auth.admin.deleteUser(user.id).catch(() => {});
  return NextResponse.json({ ok: true, caso: yo.caso });
}
