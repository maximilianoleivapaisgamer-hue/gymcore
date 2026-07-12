// Tipos del dominio GymCore (alineados con supabase/schema.sql)

export type UserRole = "super_admin" | "owner" | "member";

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
}
