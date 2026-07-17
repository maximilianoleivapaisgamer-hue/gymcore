import { createHash } from "crypto";

/** IP del visitante (detrás del proxy de Vercel). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return (xff.split(",")[0] || req.headers.get("x-real-ip") || "").trim();
}

/**
 * Hash estable de la IP (con sal secreta del servidor). NO guardamos la IP en
 * crudo; solo el hash, que sirve para comparar "misma IP" sin exponerla.
 */
export function ipHash(req: Request): string {
  const ip = clientIp(req);
  if (!ip) return "";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || "turnogym";
  return createHash("sha256").update(ip + "|" + salt).digest("hex");
}
