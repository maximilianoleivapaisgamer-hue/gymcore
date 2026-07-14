import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chatWithTool, type ChatMsg } from "@/lib/ai/anthropic";
import { ENTRENADOR_CHAT_SKILL } from "@/lib/ai/skills/entrenador-chat";
import { NUTRICIONISTA_CHAT_SKILL } from "@/lib/ai/skills/nutricionista-chat";
import { ROUTINE_SCHEMA, DIET_SCHEMA, gymHasFeature } from "@/lib/ai/persist";

/**
 * Chat conversacional del agente (entrenador o nutricionista).
 * El agente hace preguntas hasta tener todo y, cuando puede, arma la
 * rutina/dieta llamando a su herramienta. La respuesta es:
 *   { type: "message", text }   -> una pregunta/comentario más
 *   { type: "result", data }    -> la rutina/dieta lista para "Cargar en sistema"
 *
 * Requiere ANTHROPIC_API_KEY en el servidor.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: {
    kind?: "rutina" | "dieta";
    gymId?: string;
    memberName?: string | null;
    messages?: ChatMsg[];
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 }); }

  const kind = body.kind === "dieta" ? "dieta" : "rutina";
  const messages = Array.isArray(body.messages) ? body.messages.filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content) : [];
  if (!messages.length) {
    return NextResponse.json({ ok: false, error: "Falta el mensaje." }, { status: 400 });
  }

  // La IA que arma rutinas/dietas es del plan Elite (chequeo del lado del servidor).
  const gymId = String(body.gymId || "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (gymId && url && serviceKey) {
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    if (!(await gymHasFeature(admin, gymId, "ia"))) {
      return NextResponse.json({ ok: false, error: "La IA que genera rutinas y dietas está disponible en el plan Elite." }, { status: 403 });
    }
  }

  const esRutina = kind === "rutina";
  let system = esRutina ? ENTRENADOR_CHAT_SKILL : NUTRICIONISTA_CHAT_SKILL;
  if (body.memberName) {
    system += `\n\n# CONTEXTO\nLa ${esRutina ? "rutina" : "dieta"} es para el socio: ${body.memberName}. No preguntes para quién es; ya lo sabés. Podés saludarlo por su nombre.`;
  } else {
    system += `\n\n# CONTEXTO\nNo hay un socio elegido: vas a armar una plantilla general reutilizable. No preguntes para quién es.`;
  }

  try {
    const { text, result } = await chatWithTool<{ days?: unknown[] }>({
      system,
      messages,
      toolName: esRutina ? "armar_rutina" : "armar_dieta",
      toolDescription: esRutina
        ? "Arma la rutina completa con días, bloques y ejercicios cuando ya tenés la info necesaria."
        : "Arma el plan de comidas completo con días y comidas cuando ya tenés la info necesaria.",
      schema: esRutina ? ROUTINE_SCHEMA : DIET_SCHEMA,
      // Los planes largos (varios días con recetas) ocupan mucho: damos margen
      // para que no se corte a la mitad.
      maxTokens: esRutina ? 8000 : 16000,
    });

    // Si armó un resultado válido (con días), lo devolvemos para "Cargar en sistema".
    if (result && Array.isArray(result.days) && result.days.length > 0) {
      return NextResponse.json({ ok: true, type: "result", data: result, text: text || "" });
    }
    // Si "armó" algo pero quedó vacío (p. ej. se cortó), pedimos achicar en vez de romper.
    if (result) {
      return NextResponse.json({
        ok: true,
        type: "message",
        text:
          (text ? text + "\n\n" : "") +
          "Se me hizo muy largo y no llegué a completarlo. ¿Probamos con menos días o comidas para que entre completo?",
      });
    }
    return NextResponse.json({ ok: true, type: "message", text: text || "¿Podés darme un poco más de detalle?" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
