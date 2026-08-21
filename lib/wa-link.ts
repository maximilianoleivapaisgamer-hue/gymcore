"use client";

import type { MouseEvent } from "react";

/**
 * Links de WhatsApp para los PANELES (super admin y panel del dueño), donde se
 * mandan muchos mensajes seguidos desde la compu.
 *
 * Dos problemas que resuelve:
 *  1. `wa.me` en la compu te muestra una pantalla intermedia ("Abrir aplicación
 *     / Continuar en WhatsApp Web") antes de llegar al chat. Usando
 *     `web.whatsapp.com/send` vas derecho al chat con el mensaje escrito.
 *  2. Con target="_blank" cada aviso abría una pestaña NUEVA. Usando un target
 *     con nombre fijo, todos los avisos reutilizan la MISMA pestaña.
 *
 * En celular seguimos usando `wa.me`, que es lo que abre la app nativa.
 *
 * OJO: no lo uses en la landing pública ni en el portal del socio — ahí entra
 * gente desde el celular y `wa.me` es lo correcto.
 */

/** Nombre fijo de la pestaña de WhatsApp: siempre se reutiliza esta. */
export const WA_TARGET = "turnogym-whatsapp";

const soloDigitos = (s: string | null | undefined) => String(s || "").replace(/\D/g, "");

function esCelular(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** URL del chat. En compu va directo a WhatsApp Web; en celular, a la app. */
export function waUrl(phone: string | null | undefined, msg?: string): string | null {
  const p = soloDigitos(phone);
  if (!p) return null;
  const texto = msg ? encodeURIComponent(msg) : "";
  if (esCelular()) return `https://wa.me/${p}${texto ? `?text=${texto}` : ""}`;
  return `https://web.whatsapp.com/send?phone=${p}${texto ? `&text=${texto}` : ""}`;
}

/**
 * Para el `href` de un `<a>`: se calcula en el servidor, así que siempre usa
 * `wa.me` (sirve igual y es el que anda en cualquier lado). El salto a
 * WhatsApp Web lo hace `abrirWhatsapp` cuando el usuario hace click.
 */
export function waHrefBase(phone: string | null | undefined, msg?: string): string | null {
  const p = soloDigitos(phone);
  if (!p) return null;
  return `https://wa.me/${p}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
}

/**
 * Abre el chat reutilizando siempre la misma pestaña de WhatsApp.
 * Se engancha en el `onClick` de un `<a>`; si el navegador bloquea el popup,
 * deja que el link haga lo suyo normalmente.
 */
export function abrirWhatsapp(
  e: MouseEvent<HTMLAnchorElement>,
  phone: string | null | undefined,
  msg?: string,
): void {
  const url = waUrl(phone, msg);
  if (!url) return;
  const w = window.open(url, WA_TARGET);
  if (!w) return; // popup bloqueado: que siga el href de siempre
  e.preventDefault();
  w.focus();
}
