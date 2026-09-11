"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

/**
 * El ícono con el que queda instalada la app en el celular del socio.
 *
 * Se guarda en `gyms.app_icon_url` — una columna que existía en la base desde
 * hacía meses y que no leía ni escribía nadie. Lo usa el manifest por gimnasio
 * (`/manifest/<slug>`) y, más adelante, la app que se sube a las tiendas.
 *
 * Se valida que sea CUADRADO y de 512 px o más antes de subirlo: si no, el
 * teléfono lo deforma o directamente no lo toma, y eso se descubre tarde —
 * cuando el socio ya se instaló la app.
 */

const MINIMO = 512;
const MAX_MB = 5;

export default function IconoApp() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string>("");
  const [icono, setIcono] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCargando(false); return; }
      const { data: perfil } = await supabase
        .from("profiles").select("gym_id").eq("id", user.id).maybeSingle<{ gym_id: string | null }>();
      if (perfil?.gym_id) {
        setGymId(perfil.gym_id);
        const { data } = await supabase
          .from("gyms").select("name, app_icon_url").eq("id", perfil.gym_id)
          .maybeSingle<{ name: string | null; app_icon_url: string | null }>();
        setNombre((data?.name || "").trim());
        setIcono(data?.app_icon_url || null);
      }
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ancho y alto reales de la imagen, para no subir algo que no sirve. */
  function medir(file: File): Promise<{ w: number; h: number }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("no se pudo leer")); };
      img.src = url;
    });
  }

  async function subir(file: File) {
    setErr(""); setMsg("");
    if (!gymId) { setErr("No encontramos tu gimnasio."); return; }
    if (!file.type.startsWith("image/")) { setErr("Eso no es una imagen."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`La imagen pesa más de ${MAX_MB} MB.`); return; }

    let medidas;
    try { medidas = await medir(file); }
    catch { setErr("No pudimos leer la imagen. Probá con un PNG o un JPG."); return; }

    if (medidas.w !== medidas.h) {
      setErr(`Tiene que ser cuadrada. Esta mide ${medidas.w}×${medidas.h}.`);
      return;
    }
    if (medidas.w < MINIMO) {
      setErr(`Tiene que ser de ${MINIMO}×${MINIMO} o más. Esta mide ${medidas.w}×${medidas.w}.`);
      return;
    }

    setSubiendo(true);
    const path = `app-icon/${crypto.randomUUID()}-${file.name}`;
    const { error: errSubida } = await supabase.storage.from("gym-assets").upload(path, file, { upsert: true });
    if (errSubida) { setErr("No se pudo subir la imagen. Probá de nuevo."); setSubiendo(false); return; }
    const { data } = supabase.storage.from("gym-assets").getPublicUrl(path);

    const { error: errGuardar } = await supabase
      .from("gyms").update({ app_icon_url: data.publicUrl }).eq("id", gymId);
    if (errGuardar) { setErr("Se subió la imagen pero no se pudo guardar. Probá de nuevo."); setSubiendo(false); return; }

    setIcono(data.publicUrl);
    setMsg("¡Listo! Tus socios lo van a ver la próxima vez que abran la app.");
    setSubiendo(false);
  }

  async function quitar() {
    if (!gymId) return;
    setErr(""); setMsg("");
    const { error } = await supabase.from("gyms").update({ app_icon_url: null }).eq("id", gymId);
    if (error) { setErr("No se pudo quitar. Probá de nuevo."); return; }
    setIcono(null);
    setMsg("Sacado. Vuelve a usarse el ícono de turnogym.");
  }

  if (cargando || !gymId) return null;

  const inicial = (nombre || "T").charAt(0).toUpperCase();
  const corto = nombre.length <= 12 ? nombre : nombre.slice(0, 12).trim();

  return (
    <div className="card mb-4">
      <div className="mb-1 text-sm font-semibold">Ícono de tu app</div>
      <p className="mb-4 text-xs text-ink-2">
        Es el que les queda a tus socios en la pantalla del celular cuando instalan la app.
        Si no ponés ninguno, se usa el de turnogym.
      </p>

      <div className="flex flex-wrap items-start gap-5">
        {/* Cómo se ve en el teléfono, que es lo único que importa acá. */}
        <div className="text-center">
          {icono ? (
            <img src={icono} alt="" className="h-[72px] w-[72px] rounded-[18px] object-cover shadow-lg" />
          ) : (
            <div className="grid h-[72px] w-[72px] place-items-center rounded-[18px] bg-gradient-to-br from-brand to-brand-2 text-3xl font-black text-[color:var(--on-brand)] shadow-lg">
              {inicial}
            </div>
          )}
          <div className="mt-1.5 max-w-[72px] truncate text-[11px] text-ink-2">{corto || "turnogym"}</div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost text-xs" disabled={subiendo}
              onClick={() => input.current?.click()}>
              {subiendo ? "Subiendo…" : icono ? "Cambiar ícono" : "Subir ícono"}
            </button>
            {icono && (
              <button type="button" className="text-xs text-ink-2 hover:text-crit" onClick={quitar}>
                Quitar
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            Cuadrada, de {MINIMO}×{MINIMO} píxeles o más, en PNG o JPG.
            Que se entienda en chico: el logo solo, sin texto largo alrededor.
          </p>
          {msg && <p className="mt-2 text-sm text-good">{msg}</p>}
          {err && <p className="mt-2 text-sm text-crit">{err}</p>}
        </div>
      </div>

      <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ""; }} />
    </div>
  );
}
