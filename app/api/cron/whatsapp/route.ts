import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { sendTemplate, waConfigured } from "@/lib/whatsapp";
import { allows, loadPlans } from "@/lib/plans";

/**
 * Cron diario de recordatorios de cuota por WhatsApp (etapa 2).
 *
 * Lo dispara Vercel Cron una vez por día (ver vercel.json). Recorre los
 * gimnasios que tienen los recordatorios prendidos y le avisa por WhatsApp a
 * cada socio cuya cuota vence dentro de `wa_days_before` días o ya venció,
 * usando el número del propio gimnasio (gyms.wa_phone_id).
 *
 * Seguridad: solo corre si el pedido trae el CRON_SECRET, sea en el header
 * `authorization: Bearer <secreto>` (así lo manda Vercel Cron solo) o en
 * `x-cron-secret: <secreto>` (para dispararlo a mano con curl). Si la variable
 * no está cargada, el endpoint no corre: mejor no mandar nada que mandar de más.
 *
 * Anti-duplicado: a cada socio se le avisa UNA sola vez por vencimiento. Se
 * guarda en members.last_reminder_for (la fecha de vencimiento por la que se
 * avisó) y members.last_reminder_at (cuándo). Si falla el envío no se marca,
 * así se reintenta al día siguiente.
 *
 * Un envío que falla NO frena al resto: se loguea y sigue con el próximo.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Zona horaria del negocio: todo se calcula en hora de Argentina, no en UTC. */
const TZ = "America/Argentina/Buenos_Aires";

/** Tope de envíos por corrida, para no pasarnos del tiempo de la función. */
const MAX_ENVIOS = 200;

/** Cuántos socios se mandan en paralelo (para no castigar a la API de Meta). */
const TANDA = 5;

/** No perseguimos deudas viejas: si venció hace más de esto, no se avisa.
 *  Evita que la primera corrida le escriba a socios que se fueron hace meses. */
const MAX_DIAS_VENCIDO = 30;

/** Hoy en Argentina, como "YYYY-MM-DD" (membership_expiry es un date). */
function hoyAR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Suma días a una fecha "YYYY-MM-DD" y devuelve otra "YYYY-MM-DD". */
function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "2026-08-21" → "21/08/2026" (para el texto de la plantilla). */
function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const plata = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR"));

/** ¿El pedido trae el secreto del cron? */
function autorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  return (req.headers.get("x-cron-secret") || "") === secret;
}

interface GymRow {
  id: string;
  name: string | null;
  wa_phone_id: string | null;
  wa_days_before: number | null;
}

interface MemberRow {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  plan_price: number | null;
  membership_expiry: string | null;
  reminder_whatsapp: boolean | null;
  last_reminder_for: string | null;
}

async function correr() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Falta configuración de Supabase en el servidor." }, { status: 500 });
  }
  // Sin token/plantilla central de Meta no hay nada que mandar.
  if (!waConfigured()) {
    return NextResponse.json({ ok: false, error: "Falta WHATSAPP_TOKEN o WHATSAPP_TEMPLATE en el servidor." }, { status: 503 });
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const hoy = hoyAR();
  const resumen = { gimnasios: 0, enviados: 0, fallidos: 0, omitidos_vencidos_viejos: 0, tope_alcanzado: false };
  const detalle: { gym: string; enviados: number; fallidos: number; errores: string[] }[] = [];

  // Gimnasios con recordatorios prendidos y número cargado. Se excluyen las
  // demos (socios de mentira) y los archivados.
  const { data: gymsRaw, error: eGyms } = await admin
    .from("gyms")
    .select("id, name, wa_phone_id, wa_days_before")
    .eq("wa_reminders", true)
    .not("wa_phone_id", "is", null)
    .eq("is_demo", false)
    .eq("archived", false);

  if (eGyms) return NextResponse.json({ ok: false, error: eGyms.message }, { status: 500 });

  const gyms = ((gymsRaw || []) as GymRow[]).filter((g) => String(g.wa_phone_id || "").trim());
  if (!gyms.length) return NextResponse.json({ ok: true, fecha: hoy, ...resumen, detalle });

  // Plan de cada gimnasio (para el gateo) en una sola consulta.
  const { data: subs } = await admin
    .from("subscriptions")
    .select("gym_id, plan, status")
    .in("gym_id", gyms.map((g) => g.id));
  const subDe = new Map(
    (subs || []).map((s) => [s.gym_id, { plan: s.plan, status: s.status }] as [string, { plan: string; status: string }]),
  );

  // Funciones bonificadas a mano por gimnasio. Consulta aparte y best-effort:
  // si todavía no se corrió migration_034 la columna no existe, y en ese caso
  // seguimos resolviendo solo por el plan en vez de romper toda la corrida.
  const extrasDe = new Map<string, string[]>();
  try {
    const { data: ex } = await admin.from("gyms").select("id, extra_features").in("id", gyms.map((g) => g.id));
    (ex || []).forEach((r: { id: string; extra_features: string[] | null }) => extrasDe.set(r.id, r.extra_features || []));
  } catch {
    /* sin bonificadas */
  }

  const plans = await loadPlans(admin as never);
  // Misma salvaguarda que app/api/whatsapp: si ningún plan tiene la capacidad
  // "whatsapp" (todavía no se corrió migration_032), no bloqueamos a nadie.
  const gateado = plans.some((p) => (p.capabilities || []).includes("whatsapp"));

  for (const gym of gyms) {
    if (resumen.enviados + resumen.fallidos >= MAX_ENVIOS) { resumen.tope_alcanzado = true; break; }

    const sub = subDe.get(gym.id);
    // Un gimnasio que dio de baja la suscripción no le escribe a nadie.
    if (sub?.status === "canceled") continue;
    if (gateado && !allows(plans, sub?.plan ?? null, "whatsapp", extrasDe.get(gym.id))) continue;

    const diasAntes = Math.max(0, Math.min(30, gym.wa_days_before ?? 3));
    const limite = sumarDias(hoy, diasAntes);   // vence hoy, ya venció, o vence dentro de N días
    const piso = sumarDias(hoy, -MAX_DIAS_VENCIDO);

    const { data: socios, error: eSocios } = await admin
      .from("members")
      .select("id, full_name, whatsapp, plan_price, membership_expiry, reminder_whatsapp, last_reminder_for")
      .eq("gym_id", gym.id)
      .not("membership_expiry", "is", null)
      .lte("membership_expiry", limite);

    if (eSocios) {
      console.error(`[cron/whatsapp] ${gym.name}: no se pudieron leer los socios — ${eSocios.message}`);
      continue;
    }

    const pendientes = ((socios || []) as MemberRow[]).filter((m) => {
      if (m.reminder_whatsapp === false) return false;            // el socio no quiere que le avisen
      if (!String(m.whatsapp || "").trim()) return false;         // sin número no hay envío
      const vence = m.membership_expiry as string;
      if (m.last_reminder_for === vence) return false;            // ya se le avisó por este vencimiento
      if (vence < piso) { resumen.omitidos_vencidos_viejos++; return false; }
      return true;
    });

    const info = { gym: gym.name || gym.id, enviados: 0, fallidos: 0, errores: [] as string[] };

    for (let i = 0; i < pendientes.length; i += TANDA) {
      if (resumen.enviados + resumen.fallidos >= MAX_ENVIOS) { resumen.tope_alcanzado = true; break; }
      const tanda = pendientes.slice(i, i + TANDA);

      await Promise.all(tanda.map(async (m) => {
        const vence = m.membership_expiry as string;
        try {
          // Plantilla recordatorio_cuota: {{1}} nombre, {{2}} gimnasio, {{3}} vencimiento, {{4}} importe.
          await sendTemplate({
            phoneId: gym.wa_phone_id as string,
            to: m.whatsapp as string,
            params: [m.full_name || "Hola", gym.name || "tu gimnasio", fechaCorta(vence), plata(m.plan_price)],
          });
          // Recién acá marcamos: si falló, mañana se reintenta.
          await admin.from("members")
            .update({ last_reminder_at: new Date().toISOString(), last_reminder_for: vence })
            .eq("id", m.id);
          info.enviados++;
          resumen.enviados++;
        } catch (e) {
          // Un envío que falla no frena al resto.
          const msg = (e as Error).message || "error desconocido";
          console.error(`[cron/whatsapp] ${gym.name} → ${m.full_name}: ${msg}`);
          if (info.errores.length < 5) info.errores.push(`${m.full_name || m.id}: ${msg}`);
          info.fallidos++;
          resumen.fallidos++;
        }
      }));
    }

    if (info.enviados || info.fallidos) {
      resumen.gimnasios++;
      detalle.push(info);
    }
  }

  const notaViejos = resumen.omitidos_vencidos_viejos
    ? ` (${resumen.omitidos_vencidos_viejos} omitidos por vencer hace más de ${MAX_DIAS_VENCIDO} días)`
    : "";
  console.log(`[cron/whatsapp] ${hoy}: ${resumen.enviados} enviados, ${resumen.fallidos} fallidos, ${resumen.gimnasios} gimnasios${notaViejos}`);

  return NextResponse.json({ ok: true, fecha: hoy, ...resumen, detalle });
}

export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  return correr();
}

/** Mismo trabajo, por si lo querés disparar a mano con un POST. */
export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  return correr();
}
