/**
 * Cliente mínimo para la API de Claude (Anthropic).
 *
 * Usa `fetch` directo (sin instalar el SDK) y "tool-use" para FORZAR que el
 * modelo devuelva un JSON con la forma exacta que necesitamos. Así no hay que
 * parsear texto libre ni arriesgarse a que la IA conteste con explicaciones.
 *
 * Variables de entorno (van en Vercel → Project Settings → Environment Variables):
 *   - ANTHROPIC_API_KEY  (obligatoria)  → tu clave de https://console.anthropic.com
 *   - ANTHROPIC_MODEL    (opcional)     → id del modelo. Por defecto usamos el
 *                                         alias estable "claude-3-5-sonnet-latest".
 *                                         Si querés un modelo más nuevo, cambiá
 *                                         esta variable sin tocar el código.
 *
 * La clave NUNCA se expone al cliente: este archivo se importa solo desde
 * rutas de servidor (app/api/**).
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-3-5-sonnet-latest";

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
