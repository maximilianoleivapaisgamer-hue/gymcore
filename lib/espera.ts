import { createClient as createAdmin } from "@supabase/supabase-js";
import { enviarAviso, pushConfigurado, type Suscripcion } from "@/lib/push";

/**
 * La fila de espera de una clase llena.
 *
 * Cómo funciona, en criollo:
 *
 *  1. La clase está completa y el socio toca "Avisame si se libera".
 *  2. Alguien cancela.
 *  3. Al PRIMERO de la fila le llega un aviso al celular y el lugar queda
 *     GUARDADO PARA ÉL durante {@link ESPERA_MINUTOS} minutos. Nadie más lo
 *     puede tomar en ese rato: eso lo hace cumplir el trigger
 *     `enforce_class_capacity` en la base, no la pantalla.
 *  4. Si no lo toma, pasa al final de la fila y el lugar se le ofrece al
 *     siguiente.
 *
 * ⚠️ Por qué se le GUARDA el lugar en vez de anotarlo directo: con la regla de
 * cancelación prendida (DanzArte la tiene en 2 horas), anotar a alguien sin que
 * se entere le puede hacer PERDER una clase del pack si no llega a cancelar a
 * tiempo. Un lugar guardado que no toma no le cuesta nada.
 */

export const ESPERA_MINUTOS = 30;

/**
 * Si la clase arranca dentro de menos de esto, no se le guarda el lugar a
 * nadie: se avisa igual, pero el que llega primero entra. Guardarle el lugar
 * media hora a alguien cuando la clase empieza en diez minutos dejaría el lugar
 * vacío, que es justo lo que queremos evitar.
 */
const CORTE_MINUTOS = 20;

/** Argentina no cambia de hora, así que el huso es siempre -03:00. */
function arranqueDe(fecha: string, hora: string | null): Date {
  return new Date(`${fecha}T${(hora || "00:00").slice(0, 5)}:00-03:00`);
}

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
export type Admin = NonNullable<ReturnType<typeof admin>>;

/**
 * ¿Esta persona es de este gimnasio? Socio, empleado o dueño.
 *
 * Se resuelve contra la base, nunca por lo que mande el pedido. Es lo que evita
 * que con el id de una clase ajena alguien espíe el cupo o la lista de otro
 * estudio.
 */
export async function accesoAlGym(sb: Admin, userId: string, gymId: string): Promise<boolean> {
  const [{ data: socio }, { data: perfil }, { data: duenoDe }] = await Promise.all([
    sb.from("members").select("gym_id").eq("linked_user_id", userId).maybeSingle<{ gym_id: string }>(),
    sb.from("profiles").select("gym_id, role").eq("id", userId).maybeSingle<{ gym_id: string | null; role: string }>(),
    sb.from("gyms").select("id").eq("owner_id", userId).maybeSingle<{ id: string }>(),
  ]);
  return (
    socio?.gym_id === gymId ||
    perfil?.gym_id === gymId ||
    duenoDe?.id === gymId ||
    perfil?.role === "super_admin"
  );
}

export interface FilaEspera {
  id: string;
  member_id: string;
  class_id: string;
  class_date: string;
  created_at: string;
  ofrecido_at: string | null;
  vence_at: string | null;
}

interface Clase {
  id: string;
  gym_id: string;
  sede_id: string | null;
  name: string;
  start_time: string | null;
  capacity: number | null;
  image_url: string | null;
}

export interface Resultado {
  /** Qué pasó, para poder mirarlo desde el cron sin adivinar. */
  estado: "sin-lugar" | "ya-ofrecido" | "sin-fila" | "ofrecido" | "sin-cupo-cargado";
  member_id?: string;
  vence_at?: string | null;
  avisos?: number;
}

/**
 * Mueve la fila de UNA clase en UNA fecha.
 *
 * Es idempotente a propósito: se la puede llamar de más sin romper nada. Si el
 * lugar ya está guardado para alguien que todavía está en tiempo, no hace nada.
 * Por eso la llaman el portal, el panel del dueño y el cron sin coordinarse.
 */
export async function moverFila(
  sb: Admin,
  claseId: string,
  fecha: string,
): Promise<Resultado> {
  const { data: clase } = await sb
    .from("classes").select("id, gym_id, sede_id, name, start_time, capacity, image_url")
    .eq("id", claseId).maybeSingle<Clase>();
  if (!clase) return { estado: "sin-fila" };
  if (!clase.capacity || clase.capacity <= 0) return { estado: "sin-cupo-cargado" };

  const ahora = Date.now();
  const arranca = arranqueDe(fecha, clase.start_time).getTime();

  // La fila entera de esa clase, en orden de llegada.
  const { data: filaRaw } = await sb
    .from("class_waitlist")
    .select("id, member_id, class_id, class_date, created_at, ofrecido_at, vence_at")
    .eq("class_id", claseId).eq("class_date", fecha)
    .order("created_at", { ascending: true });
  const fila = (filaRaw as FilaEspera[]) || [];
  if (fila.length === 0) return { estado: "sin-fila" };

  // ¿Alguien tiene el lugar guardado y todavía está en tiempo? Entonces es suyo
  // y no se toca.
  const enTiempo = fila.find((f) => f.vence_at && new Date(f.vence_at).getTime() > ahora);
  if (enTiempo) {
    return { estado: "ya-ofrecido", member_id: enTiempo.member_id, vence_at: enTiempo.vence_at };
  }

  // A los que se les pasó el turno los mandamos al FONDO de la fila. No se los
  // borra: nadie desaparece de la lista sin enterarse, y la fila sigue girando
  // en vez de trabarse con alguien que no contesta.
  const vencidos = fila.filter((f) => f.vence_at && new Date(f.vence_at).getTime() <= ahora);
  for (const v of vencidos) {
    await sb.from("class_waitlist")
      .update({ ofrecido_at: null, vence_at: null, created_at: new Date().toISOString() })
      .eq("id", v.id);
  }

  const esperando = fila.filter((f) => !vencidos.some((v) => v.id === f.id));
  if (esperando.length === 0) return { estado: "sin-fila" };

  // ¿Hay lugar de verdad? Se cuenta acá y no se confía en la pantalla.
  const { count } = await sb
    .from("bookings").select("id", { count: "exact", head: true })
    .eq("class_id", claseId).eq("class_date", fecha);
  if ((count ?? 0) >= clase.capacity) return { estado: "sin-lugar" };

  const proximo = esperando[0];

  // Clase que arranca ya: se avisa, pero sin guardarle el lugar a nadie.
  const guardar = arranca - ahora > CORTE_MINUTOS * 60000;
  const vence = guardar
    ? new Date(Math.min(ahora + ESPERA_MINUTOS * 60000, arranca - CORTE_MINUTOS * 60000)).toISOString()
    : null;

  await sb.from("class_waitlist")
    .update({ ofrecido_at: new Date().toISOString(), vence_at: vence })
    .eq("id", proximo.id);

  const avisos = await avisar(sb, clase, fecha, proximo.member_id, vence);
  return { estado: "ofrecido", member_id: proximo.member_id, vence_at: vence, avisos };
}

/** El aviso al celular: "se liberó un lugar". Nunca hace fallar la operación. */
async function avisar(
  sb: Admin,
  clase: Clase,
  fecha: string,
  memberId: string,
  vence: string | null,
): Promise<number> {
  if (!pushConfigurado()) return 0;

  const { data: subs } = await sb
    .from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("member_id", memberId);
  const lista = (subs as Suscripcion[]) || [];
  if (lista.length === 0) return 0;

  const { data: gym } = await sb
    .from("gyms").select("app_icon_url, logo_url").eq("id", clase.gym_id)
    .maybeSingle<{ app_icon_url: string | null; logo_url: string | null }>();

  const hora = (clase.start_time || "").slice(0, 5);
  const minutos = vence ? Math.max(1, Math.round((new Date(vence).getTime() - Date.now()) / 60000)) : 0;
  const aviso = {
    titulo: `Se liberó un lugar en ${clase.name.trim()}`,
    cuerpo: vence
      ? `${hora ? `A las ${hora}. ` : ""}Te lo guardamos ${minutos} minutos: entrá y confirmá.`
      : `${hora ? `Arranca ${hora}. ` : ""}Entrá y reservá antes de que lo tomen.`,
    url: "/portal?tab=clases",
    icono: clase.image_url || gym?.app_icon_url || gym?.logo_url || null,
    // Una etiqueta por clase y fecha: si se le ofrece dos veces, el aviso se
    // reemplaza en vez de apilarse en el teléfono.
    etiqueta: `espera-${clase.id}-${fecha}`,
  };

  let enviados = 0;
  const caducadas: string[] = [];
  for (const sub of lista) {
    const r = await enviarAviso(sub, aviso);
    if (r.ok) enviados++;
    else if (r.caduca) caducadas.push(r.id);
  }
  if (caducadas.length) await sb.from("push_subscriptions").delete().in("id", caducadas);
  return enviados;
}

/**
 * Saca de todas las filas de espera las reservas que el socio ya consiguió y
 * las fechas que ya pasaron. La base ya lo saca al reservar (trigger
 * `limpiar_lista_de_espera`); esto es para las fechas viejas.
 */
export async function limpiarViejas(sb: Admin, antesDe: string) {
  await sb.from("class_waitlist").delete().lt("class_date", antesDe);
}
