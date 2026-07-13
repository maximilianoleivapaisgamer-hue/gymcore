import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateJSON } from "@/lib/ai/anthropic";
import { NUTRICIONISTA_SKILL } from "@/lib/ai/skills/nutricionista";

/**
 * Nutricionista IA: genera un plan de comidas completo para un socio y lo
 * guarda asignado a él (copia independiente).
 *
 * Requiere en el servidor:
 *   - ANTHROPIC_API_KEY (y opcional ANTHROPIC_MODEL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Nota: en el panel, las dietas están disponibles en el plan Elite. Esta ruta
 * no valida el plan (lo hace la UI); si querés forzarlo, sumá el chequeo acá.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

interface AIMeal { meal_type?: string; title?: string; detail?: string }
interface AIDay { name?: string; meals?: AIMeal[] }
interface AIDiet { name?: string; resumen?: string; days?: AIDay[] }

const DIET_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Nombre del plan" },
    resumen: { type: "string", description: "2-3 frases + aclaración obligatoria" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del día, ej 'Día 1'" },
          meals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                meal_type: { type: "string", description: "Desayuno, Almuerzo, Merienda, Cena o Colación" },
                title: { type: "string", description: "Nombre de la receta" },
                detail: { type: "string", description: "Ingredientes + pasos + kcal aprox" },
              },
              required: ["meal_type", "title", "detail"],
            },
          },
        },
        required: ["name", "meals"],
      },
    },
  },
  required: ["name", "days"],
} as const;

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }

  let body: {
    gymId?: string; memberId?: string;
    objetivo?: string; calorias?: number; comidas?: number; dias?: number;
    restricciones?: string; comentarios?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const gymId = String(body.gymId || "").trim();
  const memberId = String(body.memberId || "").trim();
  if (!gymId || !memberId) {
    return NextResponse.json({ ok: false, error: "Elegí un socio antes de generar." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: member } = await admin
    .from("members")
    .select("full_name, height_cm, observacion")
    .eq("id", memberId).eq("gym_id", gymId).single<{ full_name: string; height_cm: number | null; observacion: string | null }>();

  const memberName = member?.full_name || "el socio";
  const objetivo = String(body.objetivo || "mantenimiento y hábitos saludables").trim();
  const calorias = Number(body.calorias) || 0;
  const comidas = Math.min(6, Math.max(2, Number(body.comidas) || 4));
  const dias = Math.min(7, Math.max(1, Number(body.dias) || 7));
  const restricciones = String(body.restricciones || "").trim();
  const comentarios = String(body.comentarios || "").trim();

  const prompt = [
    `Armá un plan de comidas para ${memberName}.`,
    `Objetivo: ${objetivo}.`,
    calorias ? `Calorías orientativas por día: ${calorias} kcal.` : "No dieron calorías: usá porciones razonables.",
    `Comidas por día: ${comidas}.`,
    `Cantidad de días distintos a generar: ${dias}.`,
    restricciones ? `RESTRICCIONES a respetar sí o sí: ${restricciones}.` : "Sin restricciones declaradas.",
    member?.observacion ? `Observaciones de ficha: ${member.observacion}.` : "",
    comentarios ? `Indicaciones extra: ${comentarios}.` : "",
    `Generá exactamente ${dias} días.`,
  ].filter(Boolean).join("\n");

  let ai: AIDiet;
  try {
    ai = await generateJSON<AIDiet>({
      system: NUTRICIONISTA_SKILL,
      prompt,
      toolName: "guardar_dieta",
      toolDescription: "Guarda el plan de comidas generado con sus días y comidas.",
      schema: DIET_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 4096,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }

  const days = Array.isArray(ai.days) ? ai.days : [];
  if (!days.length) {
    return NextResponse.json({ ok: false, error: "La IA no generó comidas. Probá de nuevo." }, { status: 502 });
  }

  const dietName = (ai.name || `Plan de ${memberName}`).slice(0, 120);
  const { data: diet, error: dErr } = await admin
    .from("diets")
    .insert({ gym_id: gymId, name: `${dietName} — ${memberName}`, member_id: memberId, is_template: false })
    .select("id").single<{ id: string }>();
  if (dErr || !diet) {
    return NextResponse.json({ ok: false, error: dErr?.message || "No se pudo crear la dieta." }, { status: 500 });
  }

  const rows: Array<Record<string, unknown>> = [];
  days.forEach((d, di) => {
    (d.meals || []).forEach((m, mi) => {
      if (!m.title && !m.detail) return;
      rows.push({
        diet_id: diet.id,
        day_number: di + 1,
        meal_type: m.meal_type || "Comida",
        position: mi,
        title: m.title || "",
        detail: m.detail || "",
        photo_url: "",
      });
    });
  });
  if (rows.length) await admin.from("diet_meals").insert(rows);

  return NextResponse.json({
    ok: true,
    dietId: diet.id,
    name: dietName,
    resumen: ai.resumen || "",
    days: days.length,
    meals: rows.length,
  });
}
