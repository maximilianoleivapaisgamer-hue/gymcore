"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { TOGGLEABLE_SECTIONS, TOGGLEABLE_KEYS } from "@/lib/sections";

/**
 * Ajustes del panel: el dueño elige qué secciones usar. Las que apaga se guardan
 * en gyms.hidden_sections y desaparecen del menú lateral (se pueden volver a
 * prender cuando quiera). No toca los datos, solo qué se muestra.
 */
export default function SeccionesPage() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
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
        // select("*") para que no rompa si la columna todavía no está migrada.
        const { data } = await supabase.from("gyms").select("*").eq("id", profile.gym_id)
          .single<{ id: string; hidden_sections?: string[] | null }>();
        if (data) { setGymId(data.id); setHidden(data.hidden_sections || []); }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOn = (key: string) => !hidden.includes(key);
  function toggle(key: string) {
    setMsg(""); setErr("");
    setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  }

  async function guardar() {
    if (!gymId) return;
    setSaving(true); setMsg(""); setErr("");
    const clean = Array.from(new Set(hidden.filter((k) => TOGGLEABLE_KEYS.includes(k))));
    const { error } = await supabase.from("gyms").update({ hidden_sections: clean }).eq("id", gymId);
    setSaving(false);
    if (error) { setErr("No se pudo guardar. ¿Corriste la migración en Supabase?"); return; }
    setMsg("¡Guardado! Actualizando el menú…");
    // Recargamos para que el menú lateral tome los cambios.
    setTimeout(() => window.location.reload(), 700);
  }

  if (loading) return <div className="grid min-h-[40vh] place-items-center text-ink-2">Cargando…</div>;

  return (
    <div className="mx-auto w-full max-w-2xl p-5 md:p-7">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Secciones del panel</h1>
        <p className="mt-1 text-ink-2">Prendé o apagá las secciones según lo que uses. Las que apagues desaparecen del menú (no se borra nada, las volvés a prender cuando quieras).</p>
      </div>

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

      <div className="mt-5 flex items-center gap-3">
        <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        {msg && <span className="text-sm text-good">{msg}</span>}
        {err && <span className="text-sm text-crit">{err}</span>}
      </div>
      <p className="mt-3 text-[11px] text-muted">Inicio, Socios, Mi plan y Mi cuenta están siempre disponibles y no se pueden apagar.</p>
    </div>
  );
}
