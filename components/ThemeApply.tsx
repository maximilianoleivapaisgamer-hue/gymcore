"use client";

import { useEffect } from "react";
import { themeOf } from "@/lib/theme";

/** Aplica el color del gimnasio a toda la app seteando las variables CSS que
 * usan los botones, acentos y el fondo. Así todo combina con el mismo color. */
export default function ThemeApply({ theme }: { theme?: string | null }) {
  useEffect(() => {
    const t = themeOf(theme);
    const s = document.documentElement.style;
    s.setProperty("--brand-rgb", t.brandRgb);
    s.setProperty("--brand-2-rgb", t.brand2Rgb);
    s.setProperty("--accent", t.hex);
  }, [theme]);
  return null;
}
