"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { TOGGLEABLE_SECTIONS, TOGGLEABLE_KEYS, MEMBER_SECTIONS, MEMBER_KEYS } from "@/lib/sections";
import { BG_STYLES, themeOf } from "@/lib/theme";
import ThemePicker from "@/components/ThemePicker";
import ThemeApply from "@/components/ThemeApply";

/**
 * Configuración del panel: cómo se ve la app y qué secciones se usan.
 *
 * Junta dos cosas que antes estaban separadas y que el dueño busca en el mismo
 * momento ("quiero acomodar mi panel"): el ESTILO (colores) y las SECCIONES
 * (qué se prende y qué se apaga, para él y para sus socios).
 *
 * El estilo se previsualiza en vivo al tocarlo, pero recién se guarda con el
 * botón: un solo Guardar para todo lo de esta pantalla.
 */
export default function AjustesPage() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [hiddenMember, setHiddenMember] = useState<string[]>([]);
  const [theme, setTheme] = useState<string>("celeste");
  const [bgStyle, setBgStyle] = useState<string>("aurora");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase
        .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string | null }>();
      if (profile?.gym_id) {
        // select("*") para que no rompa si alguna columna no está migrada.
        const { data } = await supabase.from("gyms").select("*").eq("id", profile.gym_id)
          .single<{ id: string; hidden_sections?: string[] | null; hidden_member_sections?: string[] | null; theme?: string | null; bg_style?: string | null }>();
        if (data) {
          setGymId(data.id);
          setHidden(data.hidden_sections || []);
          setHiddenMember(data.hidden_member_sections || []);
          setTheme(themeOf(data.theme).key);
          setBgStyle(data.bg_style || "aurora");
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpiar = () => { setMsg(""); setErr(""); };
  const isOn = (key: string) => !hidden.includes(key);
  const isOnMember = (key: string) => !hiddenMember.includes(key);
  function toggle(key: string) {
    limpiar();
    setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  }
  function toggleMember(key: string) {
    limpiar();
    setHiddenMember((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  }

  async function guardar() {
    if (!gymId) return;
    setSaving(true); limpiar();
    const clean = Array.from(new Set(hidden.filter((k) => TOGGLEABLE_KEYS.includes(k))));
    const cleanMember = Array.from(new Set(hiddenMember.filter((k) => MEMBER_KEYS.includes(k))));
    const { error } = await supabase.from("gyms")
      .update({ hidden_sections: clean, hidden_member_sections: cleanMember, theme, bg_style: bgStyle })
      .eq("id", gymId);
    setSaving(false);
    if (error) { setErr("No se pudo guardar. Probá de nuevo."); return; }
    setMsg("¡Guardado! Actualizando…");
    // Recargamos para que el menú lateral y los colores tomen los cambios.
    setTimeout(() => window.location.reload(), 700);
  }

  if (loading) return <div className="grid min-h-[40vh] place-items-center text-ink-2">Cargando…</div>;

  return (
    <div className="mx-auto w-full max-w-2xl p-5 md:p-7">
      {/* Previsualización en vivo: lo que tocás se ve al instante. */}
      <ThemeApply theme={theme} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="mt-1 text-ink-2">Cómo se ve tu app y qué secciones usás. No se borra nada: lo volvés a cambiar cuando quieras.</p>
      </div>

      {/* ── Estilo ─────────────────────────────────────────────────────────── */}
      <h2 className="mb-1 text-sm font-semibold text-ink">Estilo de la app</h2>
      <p className="mb-3 text-xs text-ink-2">Los colores de tu panel y de la app que ven tus socios. Elegí el que vaya con tu lugar.</p>
      <ThemePicker value={theme} onChange={(k) => { limpiar(); setTheme(k); }} />

      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold text-ink-2">Fondo del panel</div>
        <div className="grid grid-cols-3 gap-2">
          {BG_STYLES.map((b) => (
            <button key={b.key} type="button" onClick={() => { limpiar(); setBgStyle(b.key); }}
              title={b.desc}
              className={`rounded-lg border p-2 text-left transition ${bgStyle === b.key ? "border-brand bg-white/5" : "border-white/10 hover:bg-white/5"}`}>
              <div className="text-xs font-semibold">{b.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Secciones del panel ────────────────────────────────────────────── */}
      <h2 className="mb-1 mt-8 text-sm font-semibold text-ink">Secciones de tu panel</h2>
      <p className="mb-3 text-xs text-ink-2">Las que apagues desaparecen de tu menú lateral.</p>
      <div className="card divide-y divide-white/[.06]">
        {TOGGLEABLE_SECTIONS.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{s.label}</div>
              <p className="text-xs text-ink-2">{s.hint}</p>
            </div>
            <button type="button" onClick={() => toggle(s.key)}
              aria-pressed={isOn(s.key)} aria-label={`Usar ${s.label}`}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${isOn(s.key) ? "bg-brand" : "bg-white/15"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${isOn(s.key) ? "left-6" : "left-1"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Secciones del socio ────────────────────────────────────────────── */}
      <h2 className="mb-1 mt-8 text-sm font-semibold text-ink">Lo que ven tus clientes en la app</h2>
      <p className="mb-3 text-xs text-ink-2">Es aparte de tu panel: podés seguir usando una sección vos y aun así ocultársela a tus socios.</p>
      <div className="card divide-y divide-white/[.06]">
        {MEMBER_SECTIONS.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{s.label}</div>
              <p className="text-xs text-ink-2">{s.hint}</p>
            </div>
            <button type="button" onClick={() => toggleMember(s.key)}
              aria-pressed={isOnMember(s.key)} aria-label={`Mostrar ${s.label} a los socios`}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${isOnMember(s.key) ? "bg-brand" : "bg-white/15"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${isOnMember(s.key) ? "left-6" : "left-1"}`} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        {msg && <span className="text-sm text-good">{msg}</span>}
        {err && <span className="text-sm text-crit">{err}</span>}
      </div>
      <p className="mt-3 text-[11px] text-muted">Inicio, Socios, Mi plan y Mi cuenta están siempre disponibles y no se pueden apagar.</p>
    </div>
  );
}
