import sharp from "sharp";
import type { Proyeccion } from "@/lib/proyeccion";

/**
 * La imagen orientativa de resultado, con Gemini.
 *
 * Anthropic no genera imágenes, así que esta función es el único lugar del
 * proyecto que habla con Google. Va con fetch directo y sin SDK, igual que
 * `lib/ai/anthropic.ts`.
 *
 * Variable de entorno:
 *   GEMINI_API_KEY  → de https://aistudio.google.com/apikey
 *
 * ⚠️ Dos cosas de acá NO son decorativas:
 *
 *  1. La instrucción empuja hacia ABAJO. El modelo, librado a su criterio,
 *     devuelve un físico de competencia. Casi todo el texto del prompt está
 *     dedicado a frenarlo: misma cara, misma ropa, mismo fondo, cambio sutil.
 *     Si la cara cambia, el socio no se ve a sí mismo y la herramienta no
 *     sirve para nada.
 *
 *  2. La leyenda se QUEMA en la imagen. Esto se hizo para compartir por
 *     WhatsApp: la imagen viaja sola, sin la pantalla que la rodea. Si el
 *     "resultado orientativo" quedara solo en la app, se pierde en el primer
 *     reenvío y lo que circula es una promesa pelada.
 */

/**
 * El modelo de imagen. Se puede cambiar con GEMINI_IMAGE_MODEL sin tocar
 * codigo ni redesplegar: Google saca uno nuevo cada pocos meses y la calidad
 * de "mantener la misma cara" cambia bastante entre versiones. Al 2026-09 los
 * disponibles son gemini-2.5-flash-image, gemini-3.1-flash-image,
 * gemini-3.1-flash-lite-image y gemini-3-pro-image.
 *
 * ⚠️ NINGUNO anda con el plan gratuito de Gemini: la generacion de imagenes
 * devuelve `limit: 0` hasta que el proyecto de Google tenga facturacion
 * habilitada. La clave autentica igual, asi que el sintoma es un 429 y no un
 * error de permisos.
 */
const MODELO = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const url = () => `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;

export const simulacionConfigurada = () => !!process.env.GEMINI_API_KEY;

/** El texto que se quema abajo de la imagen. */
export const LEYENDA = "Resultado orientativo generado por IA · No es una garantía";

/**
 * El texto que la persona tiene que aceptar ANTES de que se saque la foto.
 *
 * Se guarda tal cual en la base junto con la simulación: si algún día cambia,
 * lo que vale es lo que aceptó esa persona ese día.
 */
export const TEXTO_CONSENTIMIENTO =
  "Autorizo a que se tome una foto mía y se procese con inteligencia artificial para " +
  "generar una imagen orientativa de posibles resultados. Entiendo que la imagen es " +
  "una simulación aproximada, que NO garantiza ningún resultado, y que los resultados " +
  "reales dependen de mi constancia, mi alimentación, mi salud y mi genética. Puedo " +
  "pedir que se borre en cualquier momento.";

function prompt(p: Proyeccion, meses: number): string {
  // El cierre también tiene que escalar con la magnitud. "Keep it modest" con
  // 15 kilos pedidos es una contradicción, y el modelo le hace caso al freno:
  // devuelve un cambio de 5 o 6. Probado con una foto real.
  const grande = p.pesoActual > 0 && Math.abs(p.cambio) / p.pesoActual >= 0.07;
  const cierre = grande
    ? [
        "The result must look like the same ordinary person photographed after a real,",
        "significant transformation. The difference has to be clearly visible at a glance —",
        "an under-stated result makes this useless. Keep it photorealistic and natural:",
        "a real person who lost weight, not an athlete and not a retouched magazine photo.",
      ]
    : [
        "The result must look like an ordinary real person photographed a few months later,",
        "NOT a fitness model and NOT a retouched magazine photo. Keep it believable and modest:",
        "an exaggerated result makes this useless. Photorealistic, same photographic quality as the original.",
      ];

  return [
    "Edit this photograph of a real person to show a realistic projection of how they could look",
    `after ${meses} months of consistent gym training and a nutrition plan.`,
    "",
    "CRITICAL — these must stay EXACTLY the same, this is a projection of the same person:",
    "- The same face, identical facial features, same identity. Do not beautify or change the face.",
    "- The same hair, same skin tone, same age.",
    "- The same clothes, same pose, same background, same lighting, same camera angle.",
    "- The SAME FRAMING: identical crop, identical camera distance, the person occupying",
    "  exactly the same portion of the frame. Do NOT zoom in or out, do not reframe.",
    "",
    `CHANGE ONLY the body composition, showing ${p.descripcionFisica}`,
    // El peso concreto ancla mucho mejor que solo los kilos de diferencia.
    `For reference, this person goes from about ${p.pesoActual} kg to about ${p.pesoObjetivo} kg.`,
    "",
    ...cierre,
  ].join("\n");
}

export interface Resultado {
  ok: true;
  imagen: Buffer;
}
export interface Fallo {
  ok: false;
  error: string;
}

/**
 * Genera la imagen y le quema la leyenda.
 *
 * `foto` es el JPEG/PNG original tal como lo sacó el dueño.
 */
export async function generarSimulacion(
  foto: Buffer,
  tipo: string,
  p: Proyeccion,
  meses: number,
): Promise<Resultado | Fallo> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "Falta configurar GEMINI_API_KEY en el servidor." };

  let r: Response;
  try {
    r = await fetch(`${url()}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: tipo || "image/jpeg", data: foto.toString("base64") } },
            { text: prompt(p, meses) },
          ],
        }],
      }),
    });
  } catch {
    return { ok: false, error: "No pudimos contactar al servicio de imágenes." };
  }

  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    // El detalle crudo de Google no se le muestra al dueño, pero sirve guardarlo.
    return { ok: false, error: `El servicio de imágenes rechazó el pedido (${r.status}). ${detalle.slice(0, 200)}` };
  }

  const j = await r.json().catch(() => null) as {
    candidates?: { content?: { parts?: { inline_data?: { data?: string }; inlineData?: { data?: string } }[] } }[];
  } | null;

  const parts = j?.candidates?.[0]?.content?.parts || [];
  const b64 = parts.map((x) => x.inline_data?.data || x.inlineData?.data).find(Boolean);
  if (!b64) {
    // Pasa cuando el modelo se niega (fotos de menores, contenido sensible).
    return { ok: false, error: "El servicio no devolvió una imagen. Probá con otra foto, de cuerpo entero y con buena luz." };
  }

  try {
    // El modelo suele devolver la imagen con otro encuadre, un poco mas lejos.
    // Eso NO es cosmetico: puesta al lado de la original, la diferencia de zoom
    // hace que la persona parezca mas flaca de lo que el cambio real da, y
    // termina prometiendo de mas. Se la vuelve al tamaño y recorte exactos de
    // la foto que saco el gimnasio, asi la comparacion es pareja.
    const igualada = await mismoEncuadre(Buffer.from(b64, "base64"), foto);
    return { ok: true, imagen: await conLeyenda(igualada) };
  } catch {
    return { ok: false, error: "No pudimos terminar de armar la imagen." };
  }
}

/**
 * Deja la imagen generada con el MISMO tamaño y encuadre que la original.
 *
 * `cover` recorta los bordes para llegar a la proporcion original, que es
 * justamente lo que compensa cuando el modelo se aleja: vuelve a acercar.
 */
async function mismoEncuadre(generada: Buffer, original: Buffer): Promise<Buffer> {
  const m = await sharp(original).metadata();
  if (!m.width || !m.height) return generada;
  return sharp(generada)
    .resize(m.width, m.height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Quema la leyenda en una franja abajo de la imagen.
 *
 * Va en una franja agregada y no encima de la foto: superpuesta se puede
 * recortar de un tijeretazo, y además tapa justo la parte que la persona
 * quiere ver.
 */
export async function conLeyenda(imagen: Buffer): Promise<Buffer> {
  const meta = await sharp(imagen).metadata();
  const ancho = meta.width || 1024;
  // La franja escala con la imagen, así se lee igual en cualquier tamaño.
  const alto = Math.max(48, Math.round(ancho * 0.075));
  const fuente = Math.round(alto * 0.34);

  const franja = Buffer.from(
    `<svg width="${ancho}" height="${alto}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${ancho}" height="${alto}" fill="#0a0d12"/>
       <text x="${ancho / 2}" y="${alto / 2}" font-family="Segoe UI, Arial, sans-serif"
             font-size="${fuente}" font-weight="600" fill="#e8eaed"
             text-anchor="middle" dominant-baseline="central">${LEYENDA}</text>
     </svg>`,
  );

  return sharp(imagen)
    .extend({ bottom: alto, background: "#0a0d12" })
    .composite([{ input: franja, top: meta.height || 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
