/** Temas white-label del gimnasio: color de marca + estilo de fondo.
 * Los valores RGB se usan como variables CSS (--brand-rgb, --brand-2-rgb) para
 * que botones, acentos y el fondo se tiñan con el mismo color y siempre combinen. */
export interface Theme {
  key: string;
  label: string;
  brandRgb: string;   // "R G B" (para rgb(var(--brand-rgb) / a))
  brand2Rgb: string;
  hex: string;        // color principal en hex (para el preview / swatch)
}

export const THEMES: Theme[] = [
  { key: "celeste", label: "Celeste", brandRgb: "34 211 238", brand2Rgb: "59 130 246", hex: "#22d3ee" },
  { key: "azul", label: "Azul", brandRgb: "59 130 246", brand2Rgb: "37 99 235", hex: "#3b82f6" },
  { key: "verde", label: "Verde", brandRgb: "34 197 94", brand2Rgb: "16 185 129", hex: "#22c55e" },
  { key: "ambar", label: "Ámbar", brandRgb: "245 177 61", brand2Rgb: "234 88 12", hex: "#f5b13d" },
  { key: "violeta", label: "Violeta", brandRgb: "168 85 247", brand2Rgb: "124 58 237", hex: "#a855f7" },
  { key: "rosa", label: "Rosa", brandRgb: "244 114 182", brand2Rgb: "219 39 119", hex: "#f472b6" },
  { key: "grafito", label: "Grafito", brandRgb: "148 163 184", brand2Rgb: "71 85 105", hex: "#94a3b8" },
];

export const BG_STYLES: { key: string; label: string; desc: string }[] = [
  { key: "aurora", label: "Aurora animada", desc: "Ondas de color en movimiento." },
  { key: "suave", label: "Degradé suave", desc: "Un degradé quieto y elegante." },
  { key: "solido", label: "Sólido oscuro", desc: "Casi negro, con un toque de color." },
];

export function themeOf(key?: string | null): Theme {
  return THEMES.find((t) => t.key === key) || THEMES[0];
}
