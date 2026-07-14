import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Planes de GymCore, editables desde el Super Admin (tabla plan_configs).
 *
 * Toda la app pregunta acá "¿el plan X incluye la función Y?" con allows().
 * Si la base no responde (o está vacía), se usa DEFAULT_PLANS para que nunca
 * se rompa el gateo de funciones.
 */

export type PlanFeature = "clases" | "dietas" | "control_acceso" | "ia";
export type SubPlanKey = "basico" | "pro" | "elite";

/** Funciones que se pueden asignar a un plan (para el editor del Super Admin). */
export const ALL_FEATURES: { key: PlanFeature; label: string }[] = [
  { key: "clases", label: "Clases y reservas" },
  { key: "dietas", label: "Dietas / nutrición" },
  { key: "control_acceso", label: "Control de acceso (QR/DNI)" },
  { key: "ia", label: "IA que genera rutinas y dietas" },
];

export interface PlanConfig {
  key: SubPlanKey;
  sort: number;
  label: string;
  tagline: string;
  price: number;
  promo_price: number | null;
  promo_note: string | null;
  featured: boolean;
  features: string[];
  capabilities: PlanFeature[];
}

/** Valores por defecto (respaldo si la base no está disponible). */
export const DEFAULT_PLANS: PlanConfig[] = [
  {
    key: "basico", sort: 1, label: "Básico", tagline: "Para gimnasios que arrancan.",
    price: 49000, promo_price: null, promo_note: null, featured: false,
    features: ["Una sola sucursal", "Socios ilimitados", "Gestión de socios y cobros", "Rutinas y finanzas", "Clases y reservas", "Portal del socio", "Página pública white-label"],
    capabilities: ["clases"],
  },
  {
    key: "pro", sort: 2, label: "Pro", tagline: "Para gimnasios en crecimiento.",
    price: 79000, promo_price: null, promo_note: null, featured: true,
    features: ["Hasta 3 sucursales", "Todo lo del Básico", "Dietas y planes de comida", "Recordatorios automáticos", "Configurá tu dominio propio (ej: tugim.com.ar)"],
    capabilities: ["clases", "dietas", "control_acceso"],
  },
  {
    key: "elite", sort: 3, label: "Elite", tagline: "Para cadenas y multi-sede.",
    price: 119000, promo_price: 90000, promo_note: "Primer mes a $90.000 para gimnasios que contraten ahora.", featured: false,
    features: ["Sucursales ilimitadas", "Todo lo del Pro", "Control de acceso por QR", "Cobros online (Mercado Pago)", "Soporte prioritario"],
    capabilities: ["clases", "dietas", "control_acceso", "ia"],
  },
];

/** Carga los planes desde la base; si falla o está vacía, usa los defaults. */
export async function loadPlans(sb: SupabaseClient): Promise<PlanConfig[]> {
  try {
    const { data } = await sb.from("plan_configs").select("*").order("sort");
    if (data && data.length) {
      return (data as PlanConfig[]).map((p) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
        capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
      }));
    }
  } catch {
    /* usa defaults */
  }
  return DEFAULT_PLANS;
}

/** ¿El plan (por key) incluye esta función? */
export function allows(plans: PlanConfig[], plan: string | null | undefined, feature: PlanFeature): boolean {
  const list = plans.length ? plans : DEFAULT_PLANS;
  const p = list.find((x) => x.key === plan) || list.find((x) => x.key === "basico");
  return !!p && (p.capabilities || []).includes(feature);
}

/** Etiqueta del plan más barato que incluye la función (para los candados del menú). */
export function minPlanLabel(plans: PlanConfig[], feature: PlanFeature): string {
  const list = (plans.length ? plans : DEFAULT_PLANS).slice().sort((a, b) => a.sort - b.sort);
  return list.find((p) => (p.capabilities || []).includes(feature))?.label || "Elite";
}
