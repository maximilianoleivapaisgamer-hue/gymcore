import type { Gym, LandingSectionKey, MemberPlan } from "@/types/db";
import { DEFAULT_LANDING_SECTIONS } from "@/types/db";

/**
 * Devuelve las secciones opcionales de la landing, ya filtradas (solo las
 * tildadas como visibles Y que tienen datos cargados) y en el orden que
 * eligió el dueño en /dashboard/configuracion. El hero y el CTA final no
 * pasan por acá: siempre se renderizan aparte, al principio y al final.
 */
export function visibleLandingSections(
    gym: Partial<Pick<Gym, "landing_sections" | "benefits" | "gallery" | "address" | "whatsapp">>,
    plans: MemberPlan[]
  ): LandingSectionKey[] {
    const config = gym.landing_sections?.length ? gym.landing_sections : DEFAULT_LANDING_SECTIONS;
    const hasData: Record<LandingSectionKey, boolean> = {
          beneficios: (gym.benefits || []).length > 0,
          galeria: (gym.gallery || []).length > 0,
          planes: plans.length > 0,
          contacto: !!(gym.address || gym.whatsapp),
    };
    return config.filter((c) => c.visible && hasData[c.key]).map((c) => c.key);
}

/** Combina los planes reales sincronizados con los de marketing, en ese orden. */
export function combinedLandingPlans(gym: Partial<Pick<Gym, "real_plans" | "member_plans">>): MemberPlan[] {
    const synced: MemberPlan[] = (gym.real_plans || [])
      .filter((p) => p.sync_landing)
      .map((p) => ({ name: p.name, price: p.price, detail: p.detail }));
    return [...synced, ...(gym.member_plans || [])];
}
