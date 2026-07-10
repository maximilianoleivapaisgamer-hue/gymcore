import type { UserRole } from "@/types/db";

/** A dónde va cada rol después de iniciar sesión. */
export function redirectForRole(role: UserRole | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "member":
      return "/portal";
    case "owner":
    default:
      return "/dashboard";
  }
}
