"use client";

import { useEffect } from "react";

/**
 * Le pone al navegador la marca del gimnasio para cuando el socio instale la app.
 *
 * El layout raíz declara el manifest global de TurnoGym. Acá, ya sabiendo de qué
 * gimnasio es el socio, lo reemplazamos por el suyo: `/manifest/<slug>`. Con eso
 * el ícono que queda en el teléfono y el nombre abajo son los del negocio, no
 * los nuestros.
 *
 * Va en el portal del socio y no en el panel: el dueño usa el panel desde la
 * compu, el socio se instala la app en el celular.
 *
 * ⚠️ El iPhone ignora el manifest para el ícono de la pantalla de inicio: usa
 * `apple-touch-icon`. Por eso se escriben los dos.
 */
export default function MarcaInstalable({
  slug,
  iconUrl,
  nombre,
}: {
  slug?: string | null;
  iconUrl?: string | null;
  nombre?: string | null;
}) {
  useEffect(() => {
    if (!slug) return;

    const puestos: HTMLElement[] = [];

    /** Reemplaza la etiqueta que ya estaba, o crea una nueva. */
    const poner = (selector: string, attrs: Record<string, string>) => {
      const previo = document.head.querySelector<HTMLLinkElement>(selector);
      if (previo) previo.remove();
      const el = document.createElement("link");
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      puestos.push(el);
    };

    poner('link[rel="manifest"]', { rel: "manifest", href: `/manifest/${slug}` });
    if (iconUrl) {
      poner('link[rel="apple-touch-icon"]', { rel: "apple-touch-icon", href: iconUrl });
    }
    if (nombre) {
      // El nombre que muestra iOS debajo del ícono al agregar a inicio.
      let meta = document.head.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "apple-mobile-web-app-title");
        document.head.appendChild(meta);
        puestos.push(meta);
      }
      meta.setAttribute("content", nombre.slice(0, 12).trim());
    }

    return () => { puestos.forEach((el) => el.remove()); };
  }, [slug, iconUrl, nombre]);

  return null;
}
