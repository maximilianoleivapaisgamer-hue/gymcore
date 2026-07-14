/**
 * Cliente mínimo para la API de Claude (Anthropic).
 *
 * Usa `fetch` directo (sin instalar el SDK) y "tool-use" para FORZAR que el
 * modelo devuelva un JSON con la forma exacta que necesitamos. Así no hay que
 * parsear texto libre ni arriesgarse a que la IA conteste con explicaciones.
 *
 * Variables de entorno (van en Vercel → Project Settings → Environment Variables):
 *   - ANTHROPIC_API_KEY  (obligatoria)  → tu clave de https://console.anthropic.com
 *   - ANTHROPIC_MODEL    (opcional)     → id del modelo. Por defecto usamos
 *                                         "claude-sonnet-4-6". Otros vigentes:
 *                                         claude-opus-4-7, claude-haiku-4-5.
 *                                         Cambialo sin tocar el código.
 *
 * La clave NUNCA se expone al cliente: este archivo se importa solo desde
 * rutas de servidor (app/api/**).
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Modelo por defecto (IDs vigentes 2026: claude-opus-4-7 / claude-sonnet-4-6 / claude-haiku-4-5).
// Cambialo con la variable de entorno ANTHROPIC_MODEL sin tocar el código.
const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface GenerateJSONOpts {
  /** Instrucciones de sistema: acá va la "skill" (el criterio del experto). */
  system: string;
  /** El pedido concreto para este socio (datos + objetivo). */
  prompt: string;
  /** Nombre de la herramienta que representa la salida estructurada. */
  toolName: string;
  /** Descripción de la herramienta (para que el modelo la use bien). */
  toolDescription: string;
  /** JSON Schema de la salida esperada. */
  schema: Record<string, unknown>;
  /** Tope de tokens de salida. Por defecto 4096. */
  maxTokens?: number;
}

/**
 * Llama a Claude y devuelve el objeto JSON estructurado (ya validado por el
 * propio modelo contra el schema). Lanza Error con mensaje claro si falla.
 */
export async function generateJSON<T = unknown>(opts: GenerateJSONOpts): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY en el servidor. Cargala en Vercel → Project Settings → Environment Variables."
    );
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        system: opts.system,
        tools: [
          {
            name: opts.toolName,
            description: opts.toolDescription,
            input_schema: opts.schema,
          },
        ],
        tool_choice: { type: "tool", name: opts.toolName },
        messages: [{ role: "user", content: opts.prompt }],
      }),
    });
  } catch {
    throw new Error("No se pudo conectar con la IA. Probá de nuevo en un momento.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // 401 = clave inválida; 429 = límite/creditos; 400 = pedido mal formado.
    throw new Error(`La IA respondió con error ${res.status}. ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  const block = Array.isArray(data.content)
    ? data.content.find((c) => c.type === "tool_use" && c.input)
    : null;

  if (!block?.input) {
    throw new Error("La IA no devolvió un resultado con el formato esperado.");
  }
  return block.input as T;
}

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export interface ChatToolOpts {
  /** Instrucciones de sistema (la skill del agente). */
  system: string;
  /** Historial de la conversación. */
  messages: ChatMsg[];
  /** Herramienta que el agente usa cuando ya puede armar el resultado. */
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}

/**
 * Turno de chat: el agente puede responder con TEXTO (una pregunta más) o,
 * cuando ya tiene todo, LLAMAR a la herramienta y devolver el resultado
 * estructurado. Devuelve { text, result }: uno de los dos viene con contenido.
 */
export async function chatWithTool<T = unknown>(
  opts: ChatToolOpts
): Promise<{ text: string | null; result: T | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY en el servidor. Cargala en Vercel → Project Settings → Environment Variables."
    );
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        system: opts.system,
        tools: [
          {
            name: opts.toolName,
            description: opts.toolDescription,
            input_schema: opts.schema,
          },
        ],
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch {
    throw new Error("No se pudo conectar con la IA. Probá de nuevo en un momento.");
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`La IA respondió con error ${res.status}. ${t.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string; input?: unknown }>;
  };
  const blocks = Array.isArray(data.content) ? data.content : [];
  const toolBlock = blocks.find((c) => c.type === "tool_use" && c.input);
  const text = blocks
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text as string)
    .join("\n")
    .trim();

  return {
    text: text || null,
    result: (toolBlock?.input as T) ?? null,
  };
}
