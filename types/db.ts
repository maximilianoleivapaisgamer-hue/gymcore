// Tipos del dominio GymCore (alineados con supabase/schema.sql)

export type UserRole = "super_admin" | "owner" | "member";

export interface MemberPlan {
  name: string;
  price: number;
  detail: string;
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
  whatsapp: string | null;
  address: string | null;
  instagram: string | null;
  gallery: string[];
}

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
}
