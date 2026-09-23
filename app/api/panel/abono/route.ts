import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { estadoAbono, textoAbono, DIAS_GRACIA_POR_DEFECTO, type AbonoSub } from "@/lib/abono";
import { waHrefBase } from "@/lib/wa-link";

/**
 * En qué momento está el abono de este gimnasio con turnogym.
 *
 *   GET /api/panel/abono
 *
 * Lo usa el aviso de arriba del panel y, cuando corresponde, el cartel que
 * bloquea la pantalla. Se calcula ACÁ y no en el navegador por dos razones:
 *
 *  1. Los días de gracia generales viven en `platform_settings`, que el dueño
 *     de un gimnasio no puede leer (es configuración de la plataforma).
 *  2. Un cálculo que decide si alguien entra o no, no se hace del lado del
 *     cliente, donde se puede tocar.
 *
 * ⚠️ Esto NO es una barrera de seguridad, es una barrera comercial: lo que hay
 * detrás son los datos del propio gimnasio, no de otro. Alguien técnico podría
 * seguir pegándole a la base. Lo que sí garantiza es que el panel no se pueda
 * usar sin pagar, que es de lo que se trata.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "Falta configuración." }, { status: 500 });
  const admin = createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: perfil } = await admin
    .from("profiles").select("role, gym_id").eq("id", user.id)
    .maybeSingle<{ role: string; gym_id: string | null }>();

  // Al super admin no se le corta nunca: es el que cobra.
  if (!perfil || perfil.role === "super_admin" || !perfil.gym_id) {
    return NextResponse.json({ ok: true, cortar: false, etapa: "al-dia", aviso: null });
  }

  const [{ data: sub }, { data: cfg }] = await Promise.all([
    admin.from("subscriptions")
      .select("status, trial_ends_at, current_period_end, payment_method, dias_gracia, cortado_at")
      .eq("gym_id", perfil.gym_id).maybeSingle<AbonoSub>(),
    admin.from("platform_settings").select("dias_gracia_default, support_whatsapp").eq("id", 1)
      .maybeSingle<{ dias_gracia_default: number; support_whatsapp: string | null }>(),
  ]);

  const estado = estadoAbono(sub, cfg?.dias_gracia_default ?? DIAS_GRACIA_POR_DEFECTO);
  const aviso = textoAbono(estado, sub?.current_period_end ?? null);

  // Queda registrado el día que se corta, para saber desde cuándo está afuera.
  // No cambia nada de lo que se decide: el corte sale del cálculo, no de acá.
  if (estado.cortar && sub && !sub.cortado_at) {
    await admin.from("subscriptions")
      .update({ cortado_at: new Date().toISOString() }).eq("gym_id", perfil.gym_id);
  }

  // El "escribinos" del aviso tiene que ser un boton de verdad. Un cliente que
  // avisa que se le complico vale mucho mas que uno que se va en silencio.
  const { data: gym } = await admin
    .from("gyms").select("name").eq("id", perfil.gym_id).maybeSingle<{ name: string }>();
  const soporte = cfg?.support_whatsapp
    ? waHrefBase(cfg.support_whatsapp,
        `¡Hola! Te escribo de ${gym?.name || "mi gimnasio"} por el abono de turnogym.`)
    : null;

  return NextResponse.json({
    ok: true,
    soporte,
    cortar: estado.cortar,
    etapa: estado.etapa,
    dias_vencido: estado.diasVencido,
    fecha_corte: estado.fechaCorte,
    gracia: estado.gracia,
    // Los empleados ven el aviso pero no el bloqueo del dueño: no es su plata.
    es_dueno: perfil.role === "owner",
    aviso,
  });
}
