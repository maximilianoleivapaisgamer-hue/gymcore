// Tipos del dominio GymCore (alineados con supabase/schema.sql)

export type UserRole = "super_admin" | "owner" | "member" | "empleado";

export interface MemberPlan {
  name: string;
  price: number;
  detail: string;
}

/** Plan real del gimnasio (lo que efectivamente se cobra a los socios). Se
 * gestiona en /dashboard/planes. Si sync_landing está tildado, el plan
 * también aparece en la lista pública de "member_plans" de la landing. */
export interface RealPlan {
  name: string;
  price: number;
  detail: string;
  sync_landing: boolean;
}

/** Plantilla visual de la landing pública. Hoy hay una sola plantilla
 * (la "Clásica"): hero con banner de fondo y secciones apiladas. */
export type LandingTemplate = "clasica";
export const LANDING_TEMPLATES: { key: LandingTemplate; label: string; description: string }[] = [
  { key: "clasica", label: "Clásica", description: "Hero con banner de fondo y secciones apiladas. Cálida y directa." },
];

/** Un testimonio/opinión de socio para la landing. */
export interface Testimonial { name: string; text: string; }
/** Una fila de la grilla de horarios/clases de la landing. */
export interface ScheduleItem { day: string; time: string; name: string; }

/** Secciones opcionales de la landing: el dueño elige orden y visibilidad.
 * El hero y el CTA final no se listan acá porque siempre están presentes. */
export type LandingSectionKey = "beneficios" | "testimonios" | "horarios" | "galeria" | "planes" | "contacto";
export interface LandingSectionConfig {
  key: LandingSectionKey;
  visible: boolean;
}
export const LANDING_SECTION_LABELS: Record<LandingSectionKey, string> = {
  beneficios: "Beneficios",
  testimonios: "Testimonios",
  horarios: "Horarios y clases",
  galeria: "Galería",
  planes: "Planes",
  contacto: "Ubicación / Contacto",
};
export const DEFAULT_LANDING_SECTIONS: LandingSectionConfig[] = [
  { key: "beneficios", visible: true },
  { key: "horarios", visible: true },
  { key: "galeria", visible: true },
  { key: "testimonios", visible: true },
  { key: "planes", visible: true },
  { key: "contacto", visible: true },
];

export interface Gym {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  hero_url: string | null;
  accent_color: string;
  tagline: string | null;
  description: string | null;
  benefits: string[];
  member_plans: MemberPlan[];
  real_plans: RealPlan[];
  whatsapp: string | null;
  address: string | null;
  instagram: string | null;
  gallery: string[];
  testimonials: Testimonial[];
  class_schedule: ScheduleItem[];
  open_hours: string | null;
  landing_template: LandingTemplate;
  landing_sections: LandingSectionConfig[];
  theme: string;
  bg_style: string;
}

/** Planes de abono mensual de GymCore (lo que Maxi le cobra a cada dueño).
 * Se configuran/activan desde /admin (panel de super-admin); acá solo se
 * usan para mostrarle al dueño su plan y estado en /dashboard/mi-plan. */
export type SubPlanKey = "basico" | "pro" | "elite";
export const SUB_PLANS: { key: SubPlanKey; label: string; price: number; features: string[] }[] = [
  { key: "basico", label: "Básico", price: 15000, features: ["Socios ilimitados", "Landing pública", "Caja / finanzas"] },
  { key: "pro", label: "Pro", price: 25000, features: ["Todo lo de Básico", "Rutinas y clases", "Recordatorios automáticos"] },
  { key: "elite", label: "Elite", price: 40000, features: ["Todo lo de Pro", "Cobros online (Mercado Pago)", "Soporte prioritario"] },
];
export const SUB_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Al día", cls: "bg-[rgba(34,197,94,.14)] text-good" },
  trial: { label: "En prueba", cls: "bg-[rgba(34,211,238,.14)] text-brand" },
  past_due: { label: "Pago pendiente", cls: "bg-[rgba(245,177,61,.14)] text-warn" },
  canceled: { label: "Cancelado", cls: "bg-[rgba(240,82,82,.14)] text-crit" },
};

/** Medios de pago para la caja / cobros. */
export type PayMethod = "efectivo" | "debito" | "credito" | "mp" | "transferencia" | "otro";
export const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "mp", label: "Mercado Pago" },
  { value: "transferencia", label: "Transferencia" },
  { value: "otro", label: "Otro" },
];

export interface Member {
  id: string;
  gym_id: string;
  member_number: number | null;
  full_name: string;
  dni: string | null;
  email: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  plan_name: string | null;
  plan_price: number | null;
  membership_expiry: string | null;
  observacion: string | null;
  reminder_whatsapp: boolean;
  reminder_email: boolean;
  height_cm: number | null;
  created_at: string;
}
