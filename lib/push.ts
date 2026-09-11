import webpush from "web-push";

/**
 * Enviar avisos al celular del socio.
 *
 * Usa `web-push` y no un fetch a mano como el cliente de Anthropic: acá hay que
 * firmar un JWT y cifrar el mensaje con ECDH + HKDF + AES-GCM (RFC 8291). Eso
 * escrito a mano se rompe en silencio y es imposible de depurar, así que va
 * librería.
 *
 * Variables de entorno (ya cargadas en Vercel):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  → también la usa el navegador para suscribirse
 *   VAPID_PRIVATE_KEY             → privada, solo servidor
 *   VAPID_SUBJECT                 → "mailto:..." para el servicio de push
 */

export interface Aviso {
  titulo: string;
  cuerpo: string;
  /** A dónde lleva al tocarlo. Por defecto, el portal. */
  url?: string;
  /** Ícono del gimnasio, si tiene. */
  icono?: string | null;
  /**
   * Dos avisos con la misma etiqueta se reemplazan en vez de apilarse. Usala
   * para que el socio no se encuentre con cinco avisos de la misma clase.
   */
  etiqueta?: string;
}

export interface Suscripcion {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Lo que pasó con un envío, para que el que llama decida qué hacer. */
export type Resultado =
  | { ok: true; id: string }
  | { ok: false; id: string; caduca: boolean; motivo: string };

let configurado = false;

/** True si el servidor tiene las claves cargadas. */
export function pushConfigurado(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configurar() {
  if (configurado) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:soporte@turnogym.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  configurado = true;
}

/**
 * Manda un aviso a UN navegador.
 *
 * Nunca lanza: devuelve qué pasó. Un envío que falla no tiene que cortar el
 * recorrido de los demás — es la misma regla que el cron de WhatsApp.
 *
 * `caduca: true` significa que ese navegador ya no existe (se desinstaló la
 * app, se limpiaron los datos, venció la suscripción). Esa fila hay que
 * borrarla: si no, se reintenta para siempre.
 */
export async function enviarAviso(sub: Suscripcion, aviso: Aviso): Promise<Resultado> {
  if (!pushConfigurado()) {
    return { ok: false, id: sub.id, caduca: false, motivo: "Faltan las claves VAPID en el servidor." };
  }
  configurar();

  const carga = JSON.stringify({
    titulo: aviso.titulo,
    cuerpo: aviso.cuerpo,
    url: aviso.url || "/portal",
    icono: aviso.icono || undefined,
    etiqueta: aviso.etiqueta || undefined,
  });

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      carga,
      // Si el celular está apagado, el servicio lo guarda un rato. Tres horas
      // alcanza: un aviso de una clase que ya pasó no le sirve a nadie.
      { TTL: 60 * 60 * 3 },
    );
    return { ok: true, id: sub.id };
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    const codigo = err.statusCode ?? 0;
    // 404 y 410 los devuelve el servicio de push cuando esa suscripción ya no
    // existe. Cualquier otro error puede ser pasajero: se reintenta mañana.
    const caduca = codigo === 404 || codigo === 410;
    return {
      ok: false,
      id: sub.id,
      caduca,
      motivo: `${codigo || "sin código"} ${err.body || err.message || ""}`.trim().slice(0, 200),
    };
  }
}
