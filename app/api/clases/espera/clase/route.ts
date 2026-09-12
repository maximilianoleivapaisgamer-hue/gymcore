import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase-server";
import { admin, accesoAlGym, type FilaEspera } from "@/lib/espera";

/**
 * La lista de espera de UNA clase, para el panel del dueño.
 *
 *   GET ?class_id=…&class_date=YYYY-MM-DD
 *
 * `class_waitlist` tiene RLS sin políticas, así que el navegador no la puede
 * leer: pasa por acá. Solo la ve gente del mismo gimnasio.
 *
 * A diferencia de /avanzar, esto NO mueve la fila ni manda avisos: abrir la
 * pantalla de reservas no le tiene que cambiar el turno a nadie.
 */
export const runtime = "nodejs";

interface Fila extends FilaEspera {
  members: { full_name: string } | { full_name: string }[] | null;
}

export async function GET(req: Request) {
  const sb = admin();
  if (!sb) return NextResponse.json({ ok: false, error: "Falta configuración del servidor." }, { status: 500 });

  const { data: { user } } = await createServer().auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const url = new URL(req.url);
  const claseId = (url.searchParams.get("class_id") || "").trim();
  const fecha = (url.searchParams.get("class_date") || "").trim();
  if (!claseId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ ok: false, error: "Faltan datos de la clase." }, { status: 400 });
  }

  const { data: clase } = await sb
    .from("classes").select("id, gym_id").eq("id", claseId)
    .maybeSingle<{ id: string; gym_id: string }>();
  if (!clase) return NextResponse.json({ ok: false, error: "Esa clase no existe." }, { status: 404 });
  if (!(await accesoAlGym(sb, user.id, clase.gym_id))) {
    return NextResponse.json({ ok: false, error: "No es tu gimnasio." }, { status: 403 });
  }

  const { data } = await sb
    .from("class_waitlist")
    .select("id, member_id, class_id, class_date, created_at, ofrecido_at, vence_at, members(full_name)")
    .eq("class_id", claseId).eq("class_date", fecha)
    .order("created_at", { ascending: true });

  const ahora = Date.now();
  const fila = ((data as Fila[]) || []).map((f, i) => {
    const m = Array.isArray(f.members) ? f.members[0] : f.members;
    return {
      id: f.id,
      member_id: f.member_id,
      nombre: m?.full_name || "Socio",
      puesto: i + 1,
      // true = ahora mismo tiene el lugar guardado y está por confirmar.
      esperando_confirmar: !!f.vence_at && new Date(f.vence_at).getTime() > ahora,
    };
  });

  return NextResponse.json({ ok: true, fila });
}
