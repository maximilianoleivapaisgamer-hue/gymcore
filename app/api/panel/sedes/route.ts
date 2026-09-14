import { NextResponse } from "next/server";
import { contexto, esFallo } from "@/lib/panel";

/**
 * Las sucursales del gimnasio de quien pregunta, en UN pedido.
 *
 * Lo usa el selector de sucursal de la barra, que está en TODAS las pantallas
 * del panel. Hacía tres viajes a la base (sesión → perfil → sedes) en cada una
 * de ellas, incluso cuando después no muestra nada porque el gimnasio tiene una
 * sola sucursal — que es el caso de casi todos.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await contexto(null);
  if (esFallo(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  return NextResponse.json({
    ok: true,
    gym_id: ctx.perfil.gym_id,
    sedes: ctx.sedes,
  });
}
