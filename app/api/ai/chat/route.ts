import { NextResponse } from "next/server";
import { chatWithTool, type ChatMsg } from "@/lib/ai/anthropic";
import { ENTRENADOR_CHAT_SKILL } from "@/lib/ai/skills/entrenador-chat";
import { NUTRICIONISTA_CHAT_SKILL } from "@/lib/ai/skills/nutricionista-chat";
import { ROUTINE_SCHEMA, DIET_SCHEMA } from "@/lib/ai/persist";

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

  const esRutina = kind === "rutina";
  let system = esRutina ? ENTRENADOR_CHAT_SKILL : NUTRICIONISTA_CHAT_SKILL;
  if (body.memberName) {
    system += `\n\n# CONTEXTO\nLa ${esRutina ? "rutina" : "dieta"} es para el socio: ${body.memberName}. No preguntes para quién es; ya lo sabés. Podés saludarlo por su nombre.`;
  } else {
    system += `\n\n# CONTEXTO\nNo hay un socio elegido: vas a armar una plantilla general reutilizable. No preguntes para quién es.`;
  }

  try {
    const { text, result } = await chatWithTool({
      system,
      messages,
      toolName: esRutina ? "armar_rutina" : "armar_dieta",
      toolDescription: esRutina
        ? "Arma la rutina completa con días, bloques y ejercicios cuando ya tenés la info necesaria."
        : "Arma el plan de comidas completo con días y comidas cuando ya tenés la info necesaria.",
      schema: esRutina ? ROUTINE_SCHEMA : DIET_SCHEMA,
      maxTokens: 4096,
    });

    if (result) {
      return NextResponse.json({ ok: true, type: "result", data: result, text: text || "" });
    }
    return NextResponse.json({ ok: true, type: "message", text: text || "¿Podés darme un poco más de detalle?" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
