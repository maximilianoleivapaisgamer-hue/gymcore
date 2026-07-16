import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { CURATED } from "@/lib/exercise-library";
import { musclesEs, equipEs, levelEs, categoryEs } from "@/lib/exercise-i18n";
import { generateJSON } from "@/lib/ai/anthropic";

/**
 * Carga / actualiza la LIBRERÍA GLOBAL de ejercicios (solo super admin).
 *
 * Baja la base pública Free Exercise DB (dominio público) del lado del servidor
 * y carga TODOS los ejercicios que tengan foto. Traduce:
 *   - músculos / equipo / nivel / categoría  → por mapa fijo (gratis)
 *   - nombre / instrucciones                 → con IA (en tandas)
 *
 * Es PAGINADO: se llama con { offset, limit } y el front lo repite hasta done.
 * Idempotente (upsert por ext_id).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const DATA_URL = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
const IMG_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";

interface FEDB {
  id?: string; name: string; images: string[];
  primaryMuscles?: string[]; secondaryMuscles?: string[];
  equipment?: string | null; level?: string | null; category?: string | null;
  instructions?: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Overrides curados (traducción "linda" para los ejercicios más comunes).
const OVERRIDE = new Map(CURATED.map((c) => [norm(c.en), c]));

async function guard() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { err: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.", code: 500 as const };
  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { err: "No autenticado.", code: 401 as const };
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") return { err: "Solo el super admin.", code: 403 as const };
  return { admin };
}

let CACHE: FEDB[] | null = null;
async function loadData(): Promise<FEDB[]> {
  if (CACHE) return CACHE;
  const res = await fetch(DATA_URL, { cache: "force-cache" });
  if (!res.ok) throw new Error(`No se pudo bajar la base (HTTP ${res.status}).`);
  const all = (await res.json()) as FEDB[];
  // Solo los que tienen al menos una foto (la demo animada las necesita).
  CACHE = all
    .filter((e) => e?.name && Array.isArray(e.images) && e.images.length > 0)
    .sort((a, b) => (a.id || a.name).localeCompare(b.id || b.name));
  return CACHE;
}

const TRAD_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer" },
          nombre: { type: "string", description: "Nombre del ejercicio en español" },
          pasos: { type: "array", items: { type: "string" }, description: "Máximo 3 pasos cortos en español" },
        },
        required: ["i", "nombre", "pasos"],
      },
    },
  },
  required: ["items"],
};

export async function POST(req: Request) {
  const g = await guard();
  if ("err" in g) return NextResponse.json({ ok: false, error: g.err }, { status: g.code });

  let body: { offset?: number; limit?: number };
  try { body = await req.json(); } catch { body = {}; }
  const offset = Math.max(0, Number(body.offset) || 0);
  const limit = Math.min(25, Math.max(1, Number(body.limit) || 20));

  let data: FEDB[];
  try { data = await loadData(); } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }

  const total = data.length;
  const page = data.slice(offset, offset + limit);

  // Base de cada fila (todo lo que no necesita IA).
  const rows = page.map((ex) => ({
    gym_id: null as string | null,
    is_global: true,
    ext_id: ex.id || norm(ex.name),
    name: ex.name, // se pisa con la traducción abajo
    image_url: IMG_BASE + ex.images[0],
    image_url_end: IMG_BASE + (ex.images[1] || ex.images[0]),
    equipment: equipEs(ex.equipment),
    level: levelEs(ex.level),
    category: categoryEs(ex.category),
    primary_muscles: musclesEs(ex.primaryMuscles),
    secondary_muscles: musclesEs(ex.secondaryMuscles),
    instructions: [] as string[],
  }));

  // Traducción de nombre + instrucciones: overrides primero, IA para el resto.
  const needAI: { idx: number; name: string; steps: string[] }[] = [];
  page.forEach((ex, idx) => {
    const ov = OVERRIDE.get(norm(ex.name));
    if (ov) {
      rows[idx].name = ov.es;
      rows[idx].instructions = ov.cue;
    } else {
      needAI.push({ idx, name: ex.name, steps: (ex.instructions || []).slice(0, 4) });
    }
  });

  if (needAI.length) {
    try {
      const out = await generateJSON<{ items: { i: number; nombre: string; pasos: string[] }[] }>({
        system: "Sos traductor experto en fitness. Traducís al español rioplatense (Argentina), claro y conciso para un gimnasio. No inventás ejercicios: solo traducís lo que te pasan.",
        prompt:
          "Traducí estos ejercicios al español. Devolvé el MISMO índice i. 'nombre' = nombre del ejercicio en español; 'pasos' = instrucciones en español, MÁXIMO 3 pasos cortos.\n\n" +
          JSON.stringify(needAI.map((n) => ({ i: n.idx, name: n.name, steps: n.steps }))),
        toolName: "traducciones",
        toolDescription: "Devuelve las traducciones al español de cada ejercicio.",
        schema: TRAD_SCHEMA,
        maxTokens: 4096,
      });
      const byIdx = new Map((out.items || []).map((t) => [t.i, t]));
      for (const n of needAI) {
        const t = byIdx.get(n.idx);
        if (t) {
          rows[n.idx].name = t.nombre || n.name;
          rows[n.idx].instructions = Array.isArray(t.pasos) ? t.pasos.slice(0, 3) : [];
        }
      }
    } catch (e) {
      return NextResponse.json({ ok: false, error: "Falló la traducción con IA: " + (e as Error).message, offset }, { status: 502 });
    }
  }

  const { error } = await g.admin.from("exercises").upsert(rows, { onConflict: "ext_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message, offset }, { status: 400 });

  const nextOffset = offset + page.length;
  return NextResponse.json({ ok: true, total, processed: page.length, nextOffset, done: nextOffset >= total });
}
