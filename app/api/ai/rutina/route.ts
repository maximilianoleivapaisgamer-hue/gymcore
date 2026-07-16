import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateJSON } from "@/lib/ai/anthropic";
import { ENTRENADOR_SKILL } from "@/lib/ai/skills/entrenador";
import { capExercise } from "@/lib/exercise-i18n";

/**
 * Entrenador IA: genera una rutina completa para un socio y la guarda asignada
 * a él (copia independiente, como cuando se aplica una plantilla).
 *
 * Requiere en el servidor:
 *   - ANTHROPIC_API_KEY (y opcional ANTHROPIC_MODEL)
 *   - SUPABASE_SERVICE_ROLE_KEY  (mismo patrón que /api/socio-alta)
 */
export const runtime = "nodejs";
export const maxDuration = 60;

interface AIRow { exercise: string; sets?: string; reps?: string; notes?: string }
interface AIBlock { name?: string; rows?: AIRow[] }
interface AIDay { name?: string; blocks?: AIBlock[] }
interface AIRoutine { name?: string; resumen?: string; days?: AIDay[] }

const ROUTINE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Nombre de la rutina" },
    resumen: { type: "string", description: "1-2 frases con la lógica y cómo progresar" },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del día, ej 'Día 1 - Torso'" },
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
} as const;

const norm = (s: string) => s.trim().toLowerCase();

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }

  let body: {
    gymId?: string; memberId?: string;
    objetivo?: string; nivel?: string; dias?: number;
    equipamiento?: string; comentarios?: string; soloLibreria?: boolean;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const gymId = String(body.gymId || "").trim();
  const memberId = String(body.memberId || "").trim();
  if (!gymId || !memberId) {
    return NextResponse.json({ ok: false, error: "Elegí un socio antes de generar." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Contexto del socio (lo que tengamos: nombre, altura, observaciones).
  const { data: member } = await admin
    .from("members")
    .select("full_name, height_cm, observacion")
    .eq("id", memberId).eq("gym_id", gymId).single<{ full_name: string; height_cm: number | null; observacion: string | null }>();

  const memberName = member?.full_name || "el socio";
  const objetivo = String(body.objetivo || "salud general y estado físico").trim();
  const nivel = String(body.nivel || "principiante").trim();
  const dias = Math.min(7, Math.max(1, Number(body.dias) || 3));
  const equipamiento = String(body.equipamiento || "gimnasio completo").trim();
  const comentarios = String(body.comentarios || "").trim();

  // Nombres de la librería global (tienen demostración). Se los pasamos a la IA
  // para que los prefiera; igual puede usar otros si hace falta.
  const { data: lib } = await admin
    .from("exercises").select("name").eq("is_global", true).limit(1000);
  const libNames = (lib || []).map((e: { name: string }) => e.name);
  // "Solo librería": únicamente ejercicios con demostración. Solo tiene sentido
  // si la librería ya está cargada.
  const soloLibreria = !!body.soloLibreria && libNames.length > 0;
  const libBlock = libNames.length
    ? (soloLibreria
        ? [
            `IMPORTANTE: Usá ÚNICAMENTE ejercicios de esta lista, con el nombre EXACTO. NO inventes ni uses ninguno que no esté acá. Si falta algo, reemplazalo por el más parecido de la lista:`,
            libNames.join(" · "),
          ].join("\n")
        : [
            `Librería de ejercicios disponibles (tienen demostración en la app; USALOS con el nombre EXACTO siempre que sirvan):`,
            libNames.join(" · "),
            `Si necesitás un ejercicio que no está en la lista, podés usarlo igual (se agrega sin demostración).`,
          ].join("\n"))
    : "";

  const prompt = [
    `Armá una rutina para ${memberName}.`,
    `Objetivo: ${objetivo}.`,
    `Nivel: ${nivel}.`,
    `Días por semana: ${dias}.`,
    `Equipamiento disponible: ${equipamiento}.`,
    member?.height_cm ? `Altura: ${member.height_cm} cm.` : "",
    member?.observacion ? `Observaciones de ficha: ${member.observacion}.` : "",
    comentarios ? `Indicaciones extra del profe (incluí lesiones/limitaciones acá): ${comentarios}.` : "",
    `Generá exactamente ${dias} días de entrenamiento.`,
    libBlock,
  ].filter(Boolean).join("\n\n");

  let ai: AIRoutine;
  try {
    ai = await generateJSON<AIRoutine>({
      system: ENTRENADOR_SKILL,
      prompt,
      toolName: "guardar_rutina",
      toolDescription: "Guarda la rutina generada con sus días, bloques y ejercicios.",
      schema: ROUTINE_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 4096,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }

  const days = Array.isArray(ai.days) ? ai.days : [];
  if (!days.length) {
    return NextResponse.json({ ok: false, error: "La IA no generó ejercicios. Probá de nuevo." }, { status: 502 });
  }

  // --- Mapear ejercicios. En modo "solo librería" SOLO se linkean ejercicios de
  // la librería global (los que no matchean se descartan, no se crean). En modo
  // normal se prefiere la librería y se crean los faltantes como creados por IA.
  const { data: existing } = await admin
    .from("exercises").select("id, name, is_global").or(`gym_id.eq.${gymId},is_global.eq.true`);
  const byName = new Map<string, string>();
  if (soloLibreria) {
    (existing || []).filter((e: { is_global: boolean }) => e.is_global)
      .forEach((e: { id: string; name: string }) => byName.set(norm(e.name), e.id));
  } else {
    (existing || []).filter((e: { is_global: boolean }) => !e.is_global)
      .forEach((e: { id: string; name: string }) => byName.set(norm(e.name), e.id));
    (existing || []).filter((e: { is_global: boolean }) => e.is_global)
      .forEach((e: { id: string; name: string }) => byName.set(norm(e.name), e.id)); // pisa: preferimos librería

    const wantedNames = new Set<string>();
    days.forEach((d) => (d.blocks || []).forEach((b) => (b.rows || []).forEach((r) => {
      if (r.exercise && r.exercise.trim()) wantedNames.add(r.exercise.trim());
    })));
    const toCreate = [...wantedNames].filter((n) => !byName.has(norm(n)));
    if (toCreate.length) {
      const { data: created } = await admin
        .from("exercises")
        .insert(toCreate.map((name) => ({ gym_id: gymId, name: capExercise(name), source: "ia" })))
        .select("id, name");
      (created || []).forEach((e: { id: string; name: string }) => byName.set(norm(e.name), e.id));
    }
  }

  // --- Crear la rutina asignada al socio.
  const routineName = (ai.name || `Rutina de ${memberName}`).slice(0, 120);
  const { data: routine, error: rErr } = await admin
    .from("routines")
    .insert({ gym_id: gymId, name: `${routineName} — ${memberName}`, member_id: memberId, is_template: false })
    .select("id").single<{ id: string }>();
  if (rErr || !routine) {
    return NextResponse.json({ ok: false, error: rErr?.message || "No se pudo crear la rutina." }, { status: 500 });
  }

  // --- Filas de ejercicios (mismo esquema que el editor: position = bloque*1000 + fila).
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

  return NextResponse.json({
    ok: true,
    routineId: routine.id,
    name: routineName,
    resumen: ai.resumen || "",
    days: days.length,
    exercises: rows.length,
  });
}
