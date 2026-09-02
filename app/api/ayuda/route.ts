import { NextResponse } from "next/server";
import { createClient as createServer } from "@/lib/supabase-server";
import { chatText, type ChatMsg } from "@/lib/ai/anthropic";
import { ayudaComoTexto } from "@/lib/ayuda";

/**
 * El ayudante del centro de ayuda.
 *
 * Contesta preguntas sobre cómo se usa TurnoGym, con los artículos de
 * `lib/ayuda.ts` como única fuente. No inventa: si algo no está escrito ahí,
 * lo dice y manda a soporte.
 *
 * POR QUÉ ES BARATO: usa Haiku (el modelo chico) y los artículos van en el
 * `system` con caché de prompt. Una pregunta ronda el medio centavo de dólar.
 * Si algún día hace falta otro modelo, se cambia con AYUDA_MODEL sin tocar
 * código.
 *
 * Requiere ANTHROPIC_API_KEY en el servidor.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

/** El modelo chico alcanza y sobra para contestar sobre 6.000 palabras. */
const MODELO = process.env.AYUDA_MODEL || "claude-haiku-4-5";

/** Cuántos turnos de la charla mandamos. Más que esto no aporta y encarece. */
const MAX_TURNOS = 8;
/** Tope de caracteres por mensaje, para que nadie pegue un libro. */
const MAX_LARGO = 1000;

function instrucciones(): string {
  return `Sos el ayudante de TurnoGym, un sistema para gimnasios, estudios de pilates,
danza y entrenadores personales de Argentina. Le contestás al DUEÑO del negocio,
que está usando su panel.

CÓMO CONTESTÁS
- En español rioplatense, de vos. Cercano y directo, como una compañera de trabajo
  que conoce el sistema. Nada de "usted" ni de tono de manual.
- Corto: dos o tres frases. Si hay pasos, una lista de tres o cuatro renglones.
- Siempre decí DÓNDE está la cosa, con el camino completo:
  "Configuración → Reservas de clases". Es lo que más necesitan.
- Nada de markdown pesado: sin títulos con #, sin tablas. Texto y guiones.

DE DÓNDE SACÁS LAS RESPUESTAS
- SOLO de la documentación de abajo. Es la única fuente.
- Si la respuesta no está ahí, decilo derecho: "Eso no lo tengo documentado.
  Escribile al soporte de TurnoGym por WhatsApp y te lo resuelven." No inventes
  pantallas, botones ni funciones que no figuren.
- Si te preguntan por algo que el sistema NO hace, decilo sin vueltas en vez de
  sugerir una vuelta rara. Que lo pida como mejora es una respuesta válida.
- No hables de precios de planes, promociones ni datos de otros gimnasios.

DOCUMENTACIÓN
${ayudaComoTexto()}`;
}

export async function POST(req: Request) {
  // Solo para gente logueada: si no, es un endpoint abierto quemando tokens.
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Tenés que estar dentro de tu panel." }, { status: 401 });
  }

  let body: { messages?: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNOS)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_LARGO) }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "Falta la pregunta." }, { status: 400 });
  }

  try {
    const text = await chatText({
      system: instrucciones(),
      messages,
      model: MODELO,
      maxTokens: 700,
    });
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    // El detalle técnico va al log; al dueño le mostramos algo que se entienda.
    console.error("[ayuda]", msg);
    return NextResponse.json(
      { ok: false, error: "No pude contestarte ahora. Probá el buscador de acá arriba, o escribinos por WhatsApp." },
      { status: 502 },
    );
  }
}
