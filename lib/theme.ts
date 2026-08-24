/**
 * Estilos white-label de la app (panel del dueño + app del socio + web pública).
 *
 * No son solo "el color del botón": cada estilo cambia TODA la paleta — el
 * fondo, las superficies de las tarjetas y hasta el tono de los textos
 * secundarios. Por eso se sienten distintos entre sí y no como el mismo diseño
 * pintado de otro color.
 *
 * Los cinco mantienen la misma base oscura tipo "tech app", que es la identidad
 * de TurnoGym; lo que cambia es la TEMPERATURA de esa base (un rosa apagado en
 * las superficies para un estudio de pilates, un violeta profundo para uno de
 * danza, un casi negro neutro para el verde neón, etc.).
 *
 * ── Cómo funciona por dentro ─────────────────────────────────────────────────
 * Cada token es una variable CSS que consume Tailwind (ver tailwind.config.ts).
 * Al cambiar de estilo se reescriben las variables y se repinta toda la app
 * sola: los ~830 lugares que usan `bg-surface`, `text-ink-2`, `text-muted`, etc.
 * no hay que tocarlos uno por uno.
 *
 * ── Contraste ────────────────────────────────────────────────────────────────
 * Los valores están medidos, no elegidos a ojo. En los cinco estilos:
 *   · texto principal y secundario ≥ 4.5:1 sobre las tarjetas
 *   · el texto chico (`muted`) ≥ 4.5:1 incluso sobre la superficie más clara
 *   · el color del botón ≥ 3:1 sobre la tarjeta
 *   · el texto DENTRO del botón ≥ 4.5:1 contra los dos extremos del degradé
 * Si tocás un color, volvé a medir: el degradé del botón es el que más rápido
 * se rompe (el fucsia con violeta oscuro daba 3.5 y hubo que abrirlo).
 */
export interface Theme {
  key: string;
  label: string;
  /** Para quién es, para que el dueño elija sin pensar en colores. */
  desc: string;
  // — Base —
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  // — Texto —
  ink: string;
  ink2: string;
  muted: string;
  // — Marca (en "R G B" para poder usar rgb(var(--x) / alfa)) —
  brandRgb: string;
  brand2Rgb: string;
  /** Color del texto adentro del botón primario. */
  onBrand: string;
  /** Color principal en hex, para los swatches del selector. */
  hex: string;
  hex2: string;
}

export const THEMES: Theme[] = [
  {
    key: "celeste", label: "Cian", desc: "El clásico de TurnoGym. Sirve para cualquier rubro.",
    bg: "#0a0d12", surface: "#12161d", surface2: "#171c25", surface3: "#1d2431",
    ink: "#f4f6f8", ink2: "#9aa3b2", muted: "#868c97",
    brandRgb: "34 211 238", brand2Rgb: "59 130 246", onBrand: "#0b0a10",
    hex: "#22d3ee", hex2: "#3b82f6",
  },
  {
    key: "rosa", label: "Rosa", desc: "Suave y cálido. Para pilates, yoga y estudios chicos.",
    bg: "#100b0f", surface: "#1a1218", surface2: "#211820", surface3: "#2a1f28",
    ink: "#fbf4f8", ink2: "#c0a8b6", muted: "#98838f",
    brandRgb: "244 165 195", brand2Rgb: "236 118 168", onBrand: "#0b0a10",
    hex: "#f4a5c3", hex2: "#ec76a8",
  },
  {
    key: "fucsia", label: "Fucsia", desc: "Eléctrico y con actitud. Para danza, zumba e indoor.",
    bg: "#0c0713", surface: "#16101f", surface2: "#1d1529", surface3: "#261c34",
    ink: "#f7f2fb", ink2: "#b3a3c4", muted: "#8f82a1",
    brandRgb: "232 62 168", brand2Rgb: "217 70 239", onBrand: "#0b0a10",
    hex: "#e83ea8", hex2: "#d946ef",
  },
  {
    key: "verde", label: "Verde neón", desc: "Tech y enérgico. Para funcional, crossfit y entrenadores.",
    bg: "#080b09", surface: "#101613", surface2: "#151d19", surface3: "#1c2721",
    ink: "#f0f7f2", ink2: "#9db3a6", muted: "#7e9087",
    brandRgb: "52 211 153", brand2Rgb: "16 185 129", onBrand: "#0b0a10",
    hex: "#34d399", hex2: "#10b981",
  },
  {
    key: "ambar", label: "Ámbar", desc: "Cálido y potente. Para musculación, box y fuerza.",
    bg: "#0d0a06", surface: "#17120b", surface2: "#1e1710", surface3: "#281f15",
    ink: "#fbf6ec", ink2: "#bfae93", muted: "#958771",
    brandRgb: "245 177 61", brand2Rgb: "234 88 12", onBrand: "#0b0a10",
    hex: "#f5b13d", hex2: "#ea580c",
  },
];

export const BG_STYLES: { key: string; label: string; desc: string }[] = [
  { key: "aurora", label: "Aurora animada", desc: "Ondas de color en movimiento." },
  { key: "suave", label: "Degradé suave", desc: "Un degradé quieto y elegante." },
  { key: "solido", label: "Sólido oscuro", desc: "Casi negro, con un toque de color." },
];

/** El estilo pedido, o el primero si no existe (ej: claves viejas ya retiradas). */
export function themeOf(key?: string | null): Theme {
  return THEMES.find((t) => t.key === key) || THEMES[0];
}

/** "#12161d" → "18 22 29". Tailwind necesita los canales sueltos para poder
 *  aplicar transparencia (ej: `bg-bg/80`) sobre el mismo token. */
export function rgbOf(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Las variables CSS de un estilo. Las aplica ThemeApply y también las usa el
 *  preview del selector, para que lo que ves sea exactamente lo que queda. */
export function cssVarsOf(t: Theme): Record<string, string> {
  return {
    "--bg-rgb": rgbOf(t.bg),
    "--surface-rgb": rgbOf(t.surface),
    "--surface-2-rgb": rgbOf(t.surface2),
    "--surface-3-rgb": rgbOf(t.surface3),
    "--ink-rgb": rgbOf(t.ink),
    "--ink-2-rgb": rgbOf(t.ink2),
    "--muted-rgb": rgbOf(t.muted),
    "--brand-rgb": t.brandRgb,
    "--brand-2-rgb": t.brand2Rgb,
    "--on-brand": t.onBrand,
    "--accent": t.hex,
  };
}
