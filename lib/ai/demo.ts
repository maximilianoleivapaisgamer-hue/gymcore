import { generateJSON } from "./anthropic";

/**
 * Generador de demos con IA.
 *
 * A partir de lo que Maxi tenga del gimnasio (texto libre, el contenido de su
 * web, y/o capturas de Instagram/WhatsApp), la IA arma una configuración de
 * landing completa y verosímil para mostrarle al prospecto.
 */

// Debe coincidir con BENEFIT_ICONS de components/landing/site/Icon.tsx
const ICONS = [
  "Dumbbell", "CalendarClock", "Users", "Sparkles", "Clock", "ShieldCheck",
  "Heart", "Flame", "Trophy", "Music", "Wifi", "MapPin", "Star", "Zap", "Target", "Droplet",
];

export interface DemoAiResult {
  tagline: string;
  descripcion: string;
  marca: { primary: string; secondary: string; dark: boolean };
  beneficios: { icon: string; titulo: string; texto: string }[];
  clases: { nombre: string; dias: string; horario: string; cupo?: number }[];
  planes: { nombre: string; precio: number; periodo: string; incluye: string[]; destacado?: boolean }[];
  ubicacion: { direccion: string; ciudad: string; mapsQuery: string; horarios: { dia: string; horas: string }[] };
  whatsapp?: string;
  instagram?: string;
}

const DEMO_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    tagline: { type: "string", description: "Frase corta y potente, estilo eslogan del gimnasio." },
    descripcion: { type: "string", description: "2-3 oraciones que describen el gimnasio." },
    marca: {
      type: "object",
      properties: {
        primary: { type: "string", description: "Color de marca en hex, ej #F97316. Inferilo del logo/estilo si podés." },
        secondary: { type: "string", description: "Color secundario en hex." },
        dark: { type: "boolean", description: "true si el estilo del gimnasio pega con modo oscuro." },
      },
      required: ["primary", "secondary", "dark"],
    },
    beneficios: {
      type: "array",
      minItems: 4, maxItems: 6,
      items: {
        type: "object",
        properties: {
          icon: { type: "string", enum: ICONS },
          titulo: { type: "string" },
          texto: { type: "string" },
        },
        required: ["icon", "titulo", "texto"],
      },
    },
    clases: {
      type: "array",
      minItems: 3, maxItems: 6,
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          dias: { type: "string", description: "Ej: 'Lun · Mié · Vie'" },
          horario: { type: "string", description: "Ej: '08:00 · 19:00'" },
          cupo: { type: "number" },
        },
        required: ["nombre", "dias", "horario"],
      },
    },
    planes: {
      type: "array",
      minItems: 2, maxItems: 3,
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          precio: { type: "number", description: "Precio en pesos argentinos, número entero." },
          periodo: { type: "string", description: "Ej: 'mes' o '3 meses'." },
          incluye: { type: "array", items: { type: "string" }, minItems: 2 },
          destacado: { type: "boolean" },
        },
        required: ["nombre", "precio", "periodo", "incluye"],
      },
    },
    ubicacion: {
      type: "object",
      properties: {
        direccion: { type: "string" },
        ciudad: { type: "string" },
        mapsQuery: { type: "string", description: "Texto para buscar en Google Maps: dirección + ciudad." },
        horarios: {
          type: "array", minItems: 1,
          items: {
            type: "object",
            properties: { dia: { type: "string" }, horas: { type: "string" } },
            required: ["dia", "horas"],
          },
        },
      },
      required: ["direccion", "ciudad", "mapsQuery", "horarios"],
    },
    whatsapp: { type: "string", description: "Solo dígitos con código de país si aparece, ej 5491122334455." },
    instagram: { type: "string", description: "Usuario o link de Instagram si aparece." },
  },
  required: ["tagline", "descripcion", "marca", "beneficios", "clases", "planes", "ubicacion"],
};

const SYSTEM = `Sos un experto en marketing de gimnasios en Argentina. Tu tarea es armar el contenido de una landing page para un gimnasio, a partir de la información que te den (texto, contenido de su web, y/o capturas de Instagram/WhatsApp).

Reglas:
- Escribí SIEMPRE en español rioplatense (voseo), cálido y directo.
- Usá los datos reales que encuentres (nombre, dirección, horarios, teléfono, redes, servicios). Si la captura muestra logo/colores, inferí una paleta de marca coherente (hex).
- Lo que no tengas, completá con contenido verosímil y típico de un gimnasio de barrio (beneficios, clases, planes con precios razonables en pesos argentinos actuales). Nunca inventes datos de contacto falsos: si no hay WhatsApp/dirección, dejá esos campos vacíos o genéricos.
- Elegí íconos SOLO de la lista permitida para cada beneficio.
- Devolvé el resultado llamando a la herramienta, sin texto adicional.`;

/** Genera la config de la landing demo desde texto + web + imágenes. */
export async function generateDemoConfig(input: {
  nombre: string;
  instagram?: string;
  ciudad?: string;
  webTexto?: string;
  infoLibre?: string;
  images?: { mediaType: string; data: string }[];
}): Promise<DemoAiResult> {
  const partes: string[] = [`Gimnasio: ${input.nombre}`];
  if (input.instagram) partes.push(`Instagram: ${input.instagram}`);
  if (input.ciudad) partes.push(`Ciudad/zona: ${input.ciudad}`);
  if (input.infoLibre) partes.push(`\nInfo que pasó el usuario:\n${input.infoLibre}`);
  if (input.webTexto) partes.push(`\nContenido de su página web:\n${input.webTexto.slice(0, 6000)}`);
  if (input.images?.length) partes.push(`\nSe adjuntan ${input.images.length} captura(s) (Instagram/WhatsApp/web): leé de ahí nombre, bio, horarios, servicios y estilo visual.`);
  partes.push(`\nArmá la landing completa para "${input.nombre}".`);

  return generateJSON<DemoAiResult>({
    system: SYSTEM,
    prompt: partes.join("\n"),
    toolName: "armar_landing",
    toolDescription: "Devuelve la configuración completa de la landing del gimnasio.",
    schema: DEMO_SCHEMA,
    maxTokens: 4096,
    images: input.images,
  });
}
