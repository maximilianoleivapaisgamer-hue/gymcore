/**
 * El abono del gimnasio con turnogym: en qué momento está y si hay que cortar.
 *
 * Un solo lugar para esto, porque la misma cuenta la hacen tres pantallas y un
 * endpoint. Si cada una la hiciera por su lado, tarde o temprano una dice
 * "te quedan 2 días" mientras otra ya cortó — que es exactamente el lío que
 * tuvimos con el cartel verde "Al día" arriba de uno rojo que decía "venció".
 *
 * ── La línea de tiempo (con los 5 días por defecto) ─────────────────────
 *
 *   día 0    vence el abono            "vence hoy"
 *   días 1-2 venció                    "venció el 20/09, aboná"
 *   día 3    faltan 2 para el corte    "el 25/09 se corta el servicio"
 *   día 4    falta 1                   "MAÑANA se corta tu servicio"
 *   día 5    se acabó                  cortado
 *
 * Con otros días de gracia la línea se estira o se acorta igual: los dos avisos
 * fuertes son siempre los dos últimos días.
 */

export interface AbonoSub {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  payment_method?: string | null;
  dias_gracia?: number | null;
  cortado_at?: string | null;
}

export const DIAS_GRACIA_POR_DEFECTO = 5;

/** Con cuantos dias de anticipacion se empieza a avisar. */
export const DIAS_AVISO_PREVIO = 7;

export type EtapaAbono =
  | "al-dia"        // todo bien
  | "por-vencer"    // faltan pocos dias
  | "vence-hoy"     // último día
  | "vencido"       // ya pasó, todavía lejos del corte
  | "aviso-corte"   // faltan 2 días: se le avisa la fecha
  | "ultimo-aviso"  // falta 1: mañana se corta
  | "cortado";      // se acabó

export interface EstadoAbono {
  etapa: EtapaAbono;
  /** Días desde el vencimiento. 0 = vence hoy, negativo = todavía falta. */
  diasVencido: number;
  /** Días de gracia que se le aplican. */
  gracia: number;
  /** El día que se corta (o se cortó), como "2026-09-25". */
  fechaCorte: string | null;
  /** True solo cuando hay que bloquearle el panel. */
  cortar: boolean;
  /**
   * Por qué este gimnasio NO se toca nunca. Null si sí entra en la regla.
   * Se devuelve el motivo y no un simple false para poder mostrarlo.
   */
  exento: string | null;
}

/** Una fecha "2026-09-23" en hora de Argentina. */
export function hoyArg(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** Días entre dos fechas "YYYY-MM-DD", sin que el huso corra un día. */
function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** Suma días a una fecha "YYYY-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * En qué momento está el abono de este gimnasio.
 *
 * ⚠️ LOS FRENOS ESTÁN ACÁ, y son a propósito. Cortarle el sistema a un negocio
 * que está trabajando es lo más caro que puede hacer esta plataforma: se les
 * cae la clase, no pueden cobrar y nos putean con razón. Por eso NO se corta:
 *
 *   - al que está en prueba gratis (tiene su propio circuito),
 *   - al bonificado (`payment_method = 'gratis'`): no paga porque no tiene que pagar,
 *   - al que se le debita solo por Mercado Pago (si falla, avisa el webhook),
 *   - al que no tiene fecha de vencimiento cargada: sin fecha no hay deuda,
 *   - al que tenga días de gracia en 0... no: cero SÍ corta el mismo día, es válido.
 *
 * Cualquier duda, no se corta.
 */
export function estadoAbono(
  sub: AbonoSub | null | undefined,
  graciaGeneral = DIAS_GRACIA_POR_DEFECTO,
  hoy = hoyArg(),
): EstadoAbono {
  const gracia = sub?.dias_gracia ?? graciaGeneral;
  const base: EstadoAbono = {
    etapa: "al-dia", diasVencido: 0, gracia, fechaCorte: null, cortar: false, exento: null,
  };

  if (!sub) return { ...base, exento: "sin suscripción" };
  if (sub.status === "trial") return { ...base, exento: "está en prueba gratis" };
  if (sub.payment_method === "gratis") return { ...base, exento: "tiene el plan bonificado" };
  if (sub.payment_method === "mercadopago") return { ...base, exento: "se le debita solo" };

  const vence = (sub.current_period_end || "").slice(0, 10);
  if (!vence) return { ...base, exento: "no tiene fecha de vencimiento cargada" };

  const diasVencido = diasEntre(vence, hoy);
  const fechaCorte = sumarDias(vence, gracia);

  if (diasVencido < 0) {
    // El aviso amable de la semana previa. Es el que ya existia arriba del
    // panel; vive aca para que no haya dos cuentas distintas dando vueltas.
    const etapa: EtapaAbono = diasVencido >= -DIAS_AVISO_PREVIO ? "por-vencer" : "al-dia";
    return { ...base, etapa, diasVencido, fechaCorte };
  }
  if (diasVencido === 0) return { ...base, etapa: "vence-hoy", diasVencido, fechaCorte };

  const faltan = gracia - diasVencido;
  if (faltan <= 0) {
    return { ...base, etapa: "cortado", diasVencido, fechaCorte, cortar: true };
  }
  if (faltan === 1) return { ...base, etapa: "ultimo-aviso", diasVencido, fechaCorte };
  if (faltan === 2) return { ...base, etapa: "aviso-corte", diasVencido, fechaCorte };
  return { ...base, etapa: "vencido", diasVencido, fechaCorte };
}

/**
 * Hasta cuándo queda pago después de cobrarle un mes.
 *
 * Se estira desde el VENCIMIENTO ANTERIOR, no desde hoy, para que el día de
 * cobro no se corra todos los meses: el que vence el 20 y paga el 23 sigue
 * venciendo el 20 del mes que viene, no el 23. Si no, cada demora empuja la
 * fecha y en un año el cliente terminó pagando once meses en vez de doce.
 *
 * La excepción es el que volvió después de mucho: ahí arrancar desde una fecha
 * vieja le dejaría el vencimiento en el pasado y quedaría cortado el mismo día
 * que pagó. A ese se le cuenta desde hoy.
 */
export function proximoVencimiento(actual: string | null | undefined, hoy = hoyArg()): string {
  const base = (actual || "").slice(0, 10);
  const desde = base && diasEntre(base, hoy) <= 45 ? base : hoy;
  const d = new Date(Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10)));
  const dia = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  // El 31 de un mes que cae en uno de 30: se queda en el último día, no salta.
  if (d.getUTCDate() !== dia) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

/** "2026-09-25" → "jueves 25/09" */
export function fechaLinda(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00-03:00`);
  const dia = d.toLocaleDateString("es-AR", { weekday: "long" });
  return `${dia} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** El texto que le toca ver al dueño, según el momento. */
export function textoAbono(e: EstadoAbono, vence: string | null): { titulo: string; detalle: string } | null {
  const v = (vence || "").slice(0, 10);
  const dv = `${v.slice(8, 10)}/${v.slice(5, 7)}`;

  switch (e.etapa) {
    case "por-vencer": {
      const faltan = -e.diasVencido;
      return {
        titulo: `Tu abono vence en ${faltan} ${faltan === 1 ? "día" : "días"}, el ${dv}.`,
        detalle: "Aboná para seguir usando el sistema sin cortes.",
      };
    }
    case "vence-hoy":
      return {
        titulo: "Tu abono vence hoy.",
        detalle: "Aboná para que no se te corte el servicio.",
      };
    case "vencido":
      return {
        titulo: `Tu abono venció el ${dv}.`,
        detalle: `Tenés hasta el ${fechaLinda(e.fechaCorte)} para regularizarlo.`,
      };
    case "aviso-corte":
      return {
        titulo: `Tu abono venció el ${dv}.`,
        detalle: `Si no recibimos el pago, el ${fechaLinda(e.fechaCorte)} se va a proceder a cortar el servicio.`,
      };
    case "ultimo-aviso":
      return {
        titulo: "Mañana se corta tu servicio.",
        detalle: `Tu abono venció el ${dv}. Aboná hoy para no quedarte afuera.`,
      };
    case "cortado":
      return {
        titulo: "Tu servicio está cortado por falta de pago.",
        detalle: `Tu abono venció el ${dv}. Aboná y se reactiva al instante.`,
      };
    default:
      return null;
  }
}
