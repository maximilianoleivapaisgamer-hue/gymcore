import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient as createServer } from "@/lib/supabase-server";
import { CURATED } from "@/lib/exercise-library";

/**
 * Carga / actualiza la LIBRERÍA GLOBAL de ejercicios (solo super admin).
 *
 * Baja la base pública Free Exercise DB (dominio público) del lado del servidor,
 * cruza cada ejercicio curado por nombre, y guarda sus 2 fotos (inicio/fin) +
 * datos en español. Es idempotente (no duplica: usa ext_id).
 *
 * Se dispara con un botón desde el panel de admin.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const DATA_URL = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
const IMG_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";

interface FEDB { id?: string; name: string; images: string[]; }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });
  }

  const supa = createServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const admin = createAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (me?.role !== "super_admin") return NextResponse.json({ ok: false, error: "Solo el super admin." }, { status: 403 });

  // 1) Bajar la base pública.
  let data: FEDB[];
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    return NextResponse.json({ ok: false, error: "No se pudo bajar la base de ejercicios: " + (e as Error).message }, { status: 502 });
  }

  // 2) Índice por nombre normalizado.
  const byName = new Map<string, FEDB>();
  for (const ex of data) {
    if (ex?.name && Array.isArray(ex.images) && ex.images.length) byName.set(norm(ex.name), ex);
  }
  const find = (en: string): FEDB | null => {
    const k = norm(en);
    if (byName.has(k)) return byName.get(k)!;
    // fallback: primer ejercicio cuyo nombre contenga (o esté contenido en) el buscado
    for (const [key, ex] of byName) {
      if (key.includes(k) || k.includes(key)) return ex;
    }
    return null;
  };

  // 3) Armar filas para los ejercicios curados que existan.
  const rows: Record<string, unknown>[] = [];
  const missing: string[] = [];
  for (const c of CURATED) {
    const ex = find(c.en);
    if (!ex) { missing.push(c.en); continue; }
    const img0 = IMG_BASE + ex.images[0];
    const img1 = IMG_BASE + (ex.images[1] || ex.images[0]);
    rows.push({
      gym_id: null,
      is_global: true,
      ext_id: ex.id || norm(ex.name),
      name: c.es,
      image_url: img0,
      image_url_end: img1,
      equipment: c.equipment,
      level: c.level,
      category: "strength",
      primary_muscles: c.muscles,
      instructions: c.cue,
    });
  }

  // 4) Upsert idempotente por ext_id.
  const { error } = await admin.from("exercises").upsert(rows, { onConflict: "ext_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, cargados: rows.length, total_curados: CURATED.length, sin_match: missing });
}
