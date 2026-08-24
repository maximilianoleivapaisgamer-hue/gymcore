"use client";

import { useEffect } from "react";
import { themeOf, cssVarsOf } from "@/lib/theme";

/** Clave donde guardamos el último estilo visto, para evitar el parpadeo.
 *  La lee el script de app/layout.tsx antes del primer pintado. */
export const THEME_STORAGE_KEY = "tg-theme";

/**
 * Aplica el estilo del negocio a toda la app: fondo, superficies, textos y
 * marca. Son variables CSS, así que con esto se repinta todo (ver lib/theme.ts).
 *
 * Además guarda el estilo elegido para que la próxima carga arranque ya
 * pintada. Sin eso se veía un flash con los colores del estilo por defecto
 * antes de que React llegue a este efecto — algo que casi no se notaba cuando
 * el tema solo cambiaba el color del botón, pero canta muchísimo ahora que
 * cambia el fondo entero.
 */
export default function ThemeApply({ theme }: { theme?: string | null }) {
  useEffect(() => {
    // Sin dato todavía (el gimnasio sigue cargando): no pisamos lo que ya se
    // pintó desde el storage, para no generar el parpadeo que queremos evitar.
    if (!theme) return;

    const t = themeOf(theme);
    const s = document.documentElement.style;
    Object.entries(cssVarsOf(t)).forEach(([k, v]) => s.setProperty(k, v));

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, t.key);
    } catch {
      /* modo incógnito o storage bloqueado: solo perdemos el anti-parpadeo */
    }
  }, [theme]);

  return null;
}
