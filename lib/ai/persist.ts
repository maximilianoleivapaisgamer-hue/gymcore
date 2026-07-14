import type { SupabaseClient } from "@supabase/supabase-js";
import { planAllows, type PlanFeature } from "@/types/db";

/** ¿El plan del gimnasio habilita esta función? (chequeo del lado del servidor). */
export async function gymHasFeature(
  admin: SupabaseClient,
  gymId: string,
  feature: PlanFeature
): Promise<boolean> {
  const { data } = await admin
    .from("subscriptions").select("plan").eq("gym_id", gymId)
    .maybeSingle<{ plan: string }>();
  return planAllows(data?.plan, feature);
}

/**
 * Tipos + esquemas + guardado de rutinas/dietas generadas por IA.
 * Se usa tanto en la generación de un tiro como en el chat (al "Cargar en
 * sistema"). Centraliza el mapeo de ejercicios y el insert para no duplicar.
 */

// ---------- Tipos ----------
export interface AIRow { exercise: string; sets?: string; reps?: string; notes?: string }
export interface AIBlock { name?: string; rows?: AIRow[] }
export interface AIDay { name?: string; blocks?: AIBlock[] }
export interface AIRoutine { name?: string; resumen?: string; days?: AIDay[] }

export interface AIMeal { meal_type?: string; title?: string; detail?: string }
export interface AIDietDay { name?: string; meals?: AIMeal[] }
export interface AIDiet { name?: string; resumen?: string; days?: AIDietDay[] }

// ---------- Esquemas (para tool-use de Anthropic) ----------
export const ROUTINE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    name: { type: "string", description: "Nombre de la rutina" },
    resumen: { type: "string", description: "1-2 frases con la lógica y cómo progresar" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del día, ej 'Día 1 - Piernas'" },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nombre del bloque, ej 'A - Fuerza'" },
                rows: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      exercise: { type: "string", description: "Nombre del ejercicio" },
                      sets: { type: "string", description: "Series, ej '4'" },
                      reps: { type: "string", description: "Repeticiones, ej '8-12'" },
                      notes: { type: "string", description: "Nota corta opcional" },
                    },
                    required: ["exercise"],
                  },
                },
              },
              required: ["name", "rows"],
            },
          },
        },
        required: ["name", "blocks"],
      },
    },
  },
  required: ["name", "days"],
};

export const DIET_SCHEMA: Record<string, unknown> = {
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
};

const norm = (s: string) => s.trim().toLowerCase();

// ---------- Guardado ----------
export async function saveRoutine(
  admin: SupabaseClient,
  gymId: string,
  target: { memberId?: string | null; memberName?: string | null },
  ai: AIRoutine
): Promise<{ ok: boolean; error?: string; id?: string; name?: string; days?: number; exercises?: number }> {
  const days = Array.isArray(ai.days) ? ai.days : [];
  if (!days.length) return { ok: false, error: "La IA no generó ejercicios." };

  // Mapear ejercicios contra la biblioteca del gimnasio; crear los que falten.
  const { data: existing } = await admin.from("exercises").select("id, name").eq("gym_id", gymId);
  const byName = new Map<string, string>();
  (existing || []).forEach((e: { id: string; name: string }) => byName.set(norm(e.name), e.id));

  const wanted = new Set<string>();
  days.forEach((d) => (d.blocks || []).forEach((b) => (b.rows || []).forEach((r) => {
    if (r.exercise && r.exercise.trim()) wanted.add(r.exercise.trim());
  })));
  const toCreate = [...wanted].filter((n) => !byName.has(norm(n)));
  if (toCreate.length) {
    const { data: created } = await admin
      .from("exercises").insert(toCreate.map((name) => ({ gym_id: gymId, name }))).select("id, name");
    (created || []).forEach((e: { id: string; name: string }) => byName.set(norm(e.name), e.id));
  }

  const baseName = (ai.name || "Rutina").slice(0, 120);
  const fullName = target.memberName ? `${baseName} — ${target.memberName}` : baseName;
  const { data: routine, error } = await admin
    .from("routines")
    .insert({
      gym_id: gymId,
      name: fullName,
      member_id: target.memberId || null,
      is_template: !target.memberId,
    })
    .select("id").single<{ id: string }>();
  if (error || !routine) return { ok: false, error: error?.message || "No se pudo crear la rutina." };

  const rows: Array<Record<string, unknown>> = [];
  days.forEach((d, di) => {
    (d.blocks || []).forEach((b, bi) => {
      (b.rows || []).forEach((r, ri) => {
        const exId = r.exercise ? byName.get(norm(r.exercise)) : undefined;
        if (!exId) return;
        rows.push({
          routine_id: routine.id,
          exercise_id: exId,
          day_number: di + 1,
          block_name: b.name || null,
          position: bi * 1000 + ri,
          sets: r.sets || null,
          reps: r.reps || null,
          notes: r.notes || null,
        });
      });
    });
  });
  if (rows.length) await admin.from("routine_exercises").insert(rows);

  return { ok: true, id: routine.id, name: baseName, days: days.length, exercises: rows.length };
}

export async function saveDiet(
  admin: SupabaseClient,
  gymId: string,
  target: { memberId?: string | null; memberName?: string | null },
  ai: AIDiet
): Promise<{ ok: boolean; error?: string; id?: string; name?: string; days?: number; meals?: number }> {
  const days = Array.isArray(ai.days) ? ai.days : [];
  if (!days.length) return { ok: false, error: "La IA no generó comidas." };

  const baseName = (ai.name || "Plan de comidas").slice(0, 120);
  const fullName = target.memberName ? `${baseName} — ${target.memberName}` : baseName;
  const { data: diet, error } = await admin
    .from("diets")
    .insert({
      gym_id: gymId,
      name: fullName,
      member_id: target.memberId || null,
      is_template: !target.memberId,
    })
    .select("id").single<{ id: string }>();
  if (error || !diet) return { ok: false, error: error?.message || "No se pudo crear la dieta." };

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

  return { ok: true, id: diet.id, name: baseName, days: days.length, meals: rows.length };
}
