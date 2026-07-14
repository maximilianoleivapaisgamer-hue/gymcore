import type { Gym } from "@/types/db";
import type { CSSProperties } from "react";

/**
 * Config de la landing pública (plantilla definitiva).
 *
 * El contenido se resuelve en 3 capas que se combinan al renderizar:
 *   1) DEFAULT_LANDING  → textos de ejemplo (el dueño los edita).
 *   2) identidad del gym → nombre, color, logo, WhatsApp, dirección, Instagram.
 *   3) gym.landing_config → las ediciones guardadas del dueño.
 *
 * Así, un gimnasio recién creado ya ve la plantilla llena y con su marca, y a
 * medida que edita, sus cambios pisan el demo.
 */

export interface LBenefit {
  /** Nombre del ícono (ver components/landing/site/Icon.tsx). */
  icon: string;
  titulo: string;
  texto: string;
}
export interface LClass {
  nombre: string;
  dias: string;
  horario: string;
  cupo?: number;
}
export interface LPlan {
  nombre: string;
  precio: number;
  periodo: string;
  incluye: string[];
  destacado?: boolean;
}
export interface LPhoto {
  src: string;
  alt: string;
}
export interface LHorario {
  dia: string;
  horas: string;
}
export interface LUbicacion {
  direccion: string;
  ciudad: string;
  mapsQuery: string;
  horarios: LHorario[];
}
export interface LMarca {
  primary: string;
  secondary?: string;
  dark: boolean;
}
export interface LSecciones {
  beneficios: boolean;
  clases: boolean;
  planes: boolean;
  galeria: boolean;
}

export interface LandingConfig {
  nombre: string;
  tagline: string;
  descripcion: string;
  logoUrl: string | null;
  /** Imagen de fondo del hero (cambiable por el dueño). */
  heroImagen: string | null;
  marca: LMarca;
  whatsapp: string;
  email: string;
  telefono: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  beneficios: LBenefit[];
  clases: LClass[];
  planes: LPlan[];
  galeria: LPhoto[];
  ubicacion: LUbicacion;
  secciones: LSecciones;
}

/** Contenido demo por defecto (editable por el dueño). */
export const DEFAULT_LANDING: LandingConfig = {
  nombre: "Tu Gimnasio",
  tagline: "Entrená como en casa. Rendí como un atleta.",
  descripcion:
    "El gimnasio de barrio con equipamiento profesional, clases todos los días y una comunidad que te banca. Musculación, funcional y crosstraining en un solo lugar.",
  logoUrl: null,
  heroImagen: null,
  marca: { primary: "#22D3EE", secondary: "#3B82F6", dark: true },
  whatsapp: "",
  email: "",
  telefono: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  beneficios: [
    { icon: "Dumbbell", titulo: "Equipamiento profesional", texto: "Máquinas de última generación y peso libre para todos los niveles." },
    { icon: "CalendarClock", titulo: "Clases todos los días", texto: "Funcional, crosstraining y localizada de lunes a domingo." },
    { icon: "Users", titulo: "Profes que te siguen", texto: "Rutinas personalizadas y seguimiento real de tu progreso." },
    { icon: "Sparkles", titulo: "Instalaciones impecables", texto: "Vestuarios limpios, aire acondicionado y música siempre a punto." },
    { icon: "Clock", titulo: "Horario amplio", texto: "Abierto de 6 a 23 hs para que entrenes cuando puedas." },
    { icon: "ShieldCheck", titulo: "Sin permanencia", texto: "Planes flexibles, cancelás cuando quieras. Sin letra chica." },
  ],
  clases: [
    { nombre: "Funcional", dias: "Lun · Mié · Vie", horario: "08:00 · 18:00 · 20:00", cupo: 16 },
    { nombre: "Crosstraining", dias: "Mar · Jue", horario: "07:00 · 19:00", cupo: 12 },
    { nombre: "Localizada", dias: "Lun a Vie", horario: "10:00", cupo: 20 },
    { nombre: "Spinning", dias: "Mar · Jue · Sáb", horario: "09:00 · 19:00", cupo: 18 },
    { nombre: "Boxeo", dias: "Mié · Vie", horario: "21:00", cupo: 14 },
    { nombre: "Yoga & Movilidad", dias: "Sáb", horario: "11:00", cupo: 15 },
  ],
  planes: [
    { nombre: "Libre", precio: 18000, periodo: "mes", incluye: ["Acceso a sala de musculación", "Horario completo 6–23 hs", "App de rutinas"] },
    { nombre: "Full", precio: 24000, periodo: "mes", incluye: ["Todo lo del plan Libre", "Todas las clases incluidas", "Seguimiento con profe", "Plan de alimentación básico"], destacado: true },
    { nombre: "Trimestral", precio: 60000, periodo: "3 meses", incluye: ["Plan Full completo", "2 meses al precio de menos", "Evaluación física inicial"] },
  ],
  galeria: [],
  ubicacion: {
    direccion: "Av. Corrientes 4521",
    ciudad: "CABA, Buenos Aires",
    mapsQuery: "Av. Corrientes 4521, CABA",
    horarios: [
      { dia: "Lunes a Viernes", horas: "06:00 – 23:00" },
      { dia: "Sábados", horas: "08:00 – 20:00" },
      { dia: "Domingos y feriados", horas: "09:00 – 14:00" },
    ],
  },
  secciones: { beneficios: true, clases: true, planes: true, galeria: true },
};

/**
 * Combina en este orden:
 *   1) DEFAULT_LANDING (demo)
 *   2) gym.landing_config → contenido rico editado (beneficios, clases, planes,
 *      galería, ubicación, marca secundaria/modo, redes, secciones, etc.)
 *   3) columnas dedicadas del gym → identidad (nombre, color, logo, fondo,
 *      tagline, descripción, WhatsApp, Instagram, dirección). Son la fuente
 *      autoritativa: si el editor las cambió, se guardaron también en columna,
 *      así que nunca quedan desincronizadas ni "viejas".
 */
export function resolveLandingConfig(gym: Gym): LandingConfig {
  const base: LandingConfig = JSON.parse(JSON.stringify(DEFAULT_LANDING));

  // Capa 2: contenido rico guardado.
  const cfg = (gym.landing_config as Partial<LandingConfig> | null | undefined) ?? null;
  const hasCfg = cfg && typeof cfg === "object";
  if (hasCfg) {
    for (const key of Object.keys(cfg).filter(Boolean) as (keyof LandingConfig)[]) {
      const val = cfg[key];
      if (val === undefined || val === null) continue;
      if (key === "marca" || key === "ubicacion" || key === "secciones") {
        base[key] = { ...(base[key] as object), ...(val as object) } as never;
      } else {
        base[key] = val as never;
      }
    }
  }

  // Capa 3: identidad desde columnas (manda).
  base.nombre = gym.name || base.nombre;
  base.logoUrl = gym.logo_url ?? base.logoUrl;
  base.heroImagen = gym.hero_url ?? base.heroImagen;
  if (gym.accent_color) base.marca.primary = gym.accent_color;
  if (gym.tagline) base.tagline = gym.tagline;
  if (gym.description) base.descripcion = gym.description;
  if (gym.whatsapp) base.whatsapp = gym.whatsapp.replace(/\D/g, "");
  if (gym.instagram) base.instagram = gym.instagram;
  if (gym.address) base.ubicacion.direccion = gym.address;

  // Fallbacks: galería desde la columna vieja si el config no la definió;
  // mapsQuery a la dirección si quedó vacío.
  if (!(hasCfg && "galeria" in (cfg as object)) && Array.isArray(gym.gallery) && gym.gallery.length) {
    base.galeria = gym.gallery.filter(Boolean).map((src) => ({ src, alt: gym.name }));
  }
  if (!base.ubicacion.mapsQuery && gym.address) base.ubicacion.mapsQuery = gym.address;

  return base;
}

/** Links del portal derivados del slug del gimnasio. */
export function landingLinks(slug: string) {
  return {
    portalUrl: `/g/${slug}`,
    joinHref: `/portal/registro?gym=${slug}`,
    loginHref: `/g/${slug}`,
  };
}

// ---------- Marca: CSS variables con contraste automático (portado de brand.ts) ----------

type Rgb = { r: number; g: number; b: number };
function hexToRgb(hex: string): Rgb {
  let h = (hex || "#22D3EE").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function relLum({ r, g, b }: Rgb): number {
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
function contrast(a: Rgb, b: Rgb): number {
  const la = relLum(a), lb = relLum(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
/** Color de texto (blanco o casi-negro) más legible sobre bg. */
export function readableForeground(bgHex: string): string {
  const bg = hexToRgb(bgHex);
  return contrast(bg, { r: 255, g: 255, b: 255 }) >= contrast(bg, { r: 17, g: 24, b: 39 })
    ? "#ffffff"
    : "#111827";
}

const LIGHT = { bg: "#FAFAFA", surface: "#FFFFFF", surface2: "#F3F4F6", text: "#0F172A", muted: "#64748B", border: "#E5E7EB" };
const DARK = { bg: "#0B0F16", surface: "#111827", surface2: "#0F1623", text: "#E6EDF3", muted: "#94A3B8", border: "rgba(230,237,243,0.10)" };

/** CSS variables de la landing (colores + contraste) para el root del sitio. */
export function landingBrandStyle(marca: LMarca): CSSProperties {
  const p = marca.dark ? DARK : LIGHT;
  const primary = marca.primary || "#22D3EE";
  const secondary = marca.secondary || primary;
  const vars: Record<string, string> = {
    "--l-brand": primary,
    "--l-brand-2": secondary,
    "--l-brand-fg": readableForeground(primary),
    "--l-bg": p.bg,
    "--l-surface": p.surface,
    "--l-surface-2": p.surface2,
    "--l-text": p.text,
    "--l-muted": p.muted,
    "--l-border": p.border,
  };
  return vars as unknown as CSSProperties;
}
