import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveRoutine, saveDiet, gymHasFeature, type AIRoutine, type AIDiet } from "@/lib/ai/persist";

/**
 * "Cargar en sistema": persiste la rutina/dieta que armó el agente en el chat,
 * asignándola al socio elegido (o como plantilla si no hay socio).
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el servidor.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }

  let body: {
    kind?: "rutina" | "dieta";
    gymId?: string;
    memberId?: string | null;
    data?: AIRoutine | AIDiet;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const kind = body.kind === "dieta" ? "dieta" : "rutina";
  const gymId = String(body.gymId || "").trim();
  const memberId = body.memberId ? String(body.memberId).trim() : null;
  if (!gymId || !body.data) {
    return NextResponse.json({ ok: false, error: "Faltan datos para guardar." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // La IA que arma rutinas/dietas es del plan Elite.
  if (!(await gymHasFeature(admin, gymId, "ia"))) {
    return NextResponse.json({ ok: false, error: "La IA que genera rutinas y dietas está disponible en el plan Elite." }, { status: 403 });
  }

  // Nombre del socio (para el título de la copia), si hay socio.
  let memberName: string | null = null;
  if (memberId) {
    const { data: m } = await admin
      .from("members").select("full_name").eq("id", memberId).eq("gym_id", gymId)
      .single<{ full_name: string }>();
    memberName = m?.full_name || null;
  }

  const res = kind === "rutina"
    ? await saveRoutine(admin, gymId, { memberId, memberName }, body.data as AIRoutine)
    : await saveDiet(admin, gymId, { memberId, memberName }, body.data as AIDiet);

  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, ...res });
}
