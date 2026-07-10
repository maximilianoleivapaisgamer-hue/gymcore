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
}

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
