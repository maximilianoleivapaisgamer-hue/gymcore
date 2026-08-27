"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { TOGGLEABLE_SECTIONS, TOGGLEABLE_KEYS, MEMBER_SECTIONS, MEMBER_KEYS } from "@/lib/sections";
import { BG_STYLES, themeOf } from "@/lib/theme";
import ThemePicker from "@/components/ThemePicker";
import ThemeApply from "@/components/ThemeApply";
import PreviewSocio from "@/components/PreviewSocio";
import { nuevoVencimiento, fechaCorta, type CobroConfig } from "@/lib/fechas";

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
  const [gym, setGym] = useState<{ name: string | null; logo_url: string | null }>({ name: null, logo_url: null });
  const [bgStyle, setBgStyle] = useState<string>("aurora");
  /** Cómo cobra el negocio: aniversario o día fijo, y el recargo por atraso. */
  const [cobro, setCobro] = useState<CobroConfig>({ cobro_modo: "aniversario", cobro_dia: 10, recargo_tipo: null, recargo_valor: null });
  /** Venta de clases sueltas: si las vende y a cuanto. */
  const [clase, setClase] = useState<{ activa: boolean; precio: number | null }>({ activa: false, precio: null });
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
          .single<{ id: string; name: string | null; logo_url: string | null; hidden_sections?: string[] | null; hidden_member_sections?: string[] | null; theme?: string | null; bg_style?: string | null }>();
        if (data) {
          setGymId(data.id);
          setGym({ name: data.name, logo_url: data.logo_url });
          setHidden(data.hidden_sections || []);
          setHiddenMember(data.hidden_member_sections || []);
          setTheme(themeOf(data.theme).key);
          setBgStyle(data.bg_style || "aurora");
          const d = data as unknown as CobroConfig;
          const c = data as unknown as { clase_suelta_activa?: boolean; clase_suelta_precio?: number | null };
          setClase({ activa: !!c.clase_suelta_activa, precio: c.clase_suelta_precio != null ? Number(c.clase_suelta_precio) : null });
          setCobro({
            cobro_modo: d.cobro_modo || "aniversario",
            cobro_dia: Number(d.cobro_dia) || 10,
            recargo_tipo: d.recargo_tipo || null,
            recargo_valor: d.recargo_valor != null ? Number(d.recargo_valor) : null,
          });
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
      .update({
        hidden_sections: clean, hidden_member_sections: cleanMember, theme, bg_style: bgStyle,
        cobro_modo: cobro.cobro_modo || "aniversario",
        cobro_dia: Math.min(28, Math.max(1, Number(cobro.cobro_dia) || 10)),
        recargo_tipo: cobro.recargo_tipo || null,
        recargo_valor: cobro.recargo_tipo ? (Number(cobro.recargo_valor) || 0) : null,
        clase_suelta_activa: clase.activa,
        clase_suelta_precio: clase.activa ? (Number(clase.precio) || 0) : null,
      })
      .eq("id", gymId);
    setSaving(false);
    if (error) { setErr("No se pudo guardar. Probá de nuevo."); return; }
    setMsg("¡Guardado! Actualizando…");
    // Recargamos para que el menú lateral y los colores tomen los cambios.
    setTimeout(() => window.location.reload(), 700);
  }

  if (loading) return <div className="grid min-h-[40vh] place-items-center text-ink-2">Cargando…</div>;

  return (
    <div className="mx-auto w-full max-w-5xl p-5 md:p-7">
      {/* Previsualización en vivo: lo que tocás se ve al instante. */}
      <ThemeApply theme={theme} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="mt-1 text-ink-2">Cómo se ve tu app y qué secciones usás. No se borra nada: lo volvés a cambiar cuando quieras.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_268px] lg:gap-8">
        <div className="min-w-0">

      {/* ── Estilo ─────────────────────────────────────────────────────────── */}
      <h2 className="mb-1 text-sm font-semibold text-ink">Estilo de la app</h2>
      <p className="mb-3 text-xs text-ink-2">Los colores de tu panel y de la app que ven tus socios. Elegí el que vaya con tu lugar.</p>
      <ThemePicker value={theme} onChange={(k) => { limpiar(); setTheme(k); }} />

      {/* En celular la vista previa va acá, pegada a lo que previsualiza. */}
      <div className="mt-5 lg:hidden">
        <PreviewSocio theme={theme} nombre={gym.name} logoUrl={gym.logo_url} ocultas={hiddenMember} />
      </div>

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

      {/* ── Cobros ─────────────────────────────────────────────────────────── */}
      <h2 className="mb-1 mt-8 text-sm font-semibold text-ink">Cobros</h2>
      <p className="mb-3 text-xs text-ink-2">Cuándo le vence la cuota a tus socios cuando les cobrás.</p>
      <div className="card space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ["aniversario", "Un mes desde que paga", "Cada socio tiene su fecha. Paga el 20 → le vence el 20 del mes que viene."],
            ["dia_fijo", "Todos el mismo día", "Como “las cuotas se pagan del 1 al 10”. A todos les vence el mismo día del mes."],
          ] as const).map(([k, titulo, desc]) => (
            <button key={k} type="button"
              onClick={() => { limpiar(); setCobro((c) => ({ ...c, cobro_modo: k })); }}
              className={`rounded-lg border p-3 text-left transition ${
                (cobro.cobro_modo || "aniversario") === k ? "border-brand bg-[rgba(34,211,238,.07)]" : "border-white/10 hover:border-white/20"
              }`}>
              <div className={`text-sm font-semibold ${(cobro.cobro_modo || "aniversario") === k ? "text-brand" : "text-ink"}`}>{titulo}</div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{desc}</p>
            </button>
          ))}
        </div>

        {cobro.cobro_modo === "dia_fijo" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <span className="text-xs text-ink-2">Vencen el día</span>
            <input type="number" min={1} max={28} className="input w-20"
              value={cobro.cobro_dia ?? 10}
              onChange={(e) => { limpiar(); setCobro((c) => ({ ...c, cobro_dia: Number(e.target.value) || 10 })); }} />
            <span className="text-xs text-ink-2">de cada mes</span>
          </div>
        )}

        <div className="border-t border-white/10 pt-3">
          <div className="mb-2 text-xs font-semibold text-ink-2">Recargo por pagar tarde</div>
          <div className="flex flex-wrap gap-2">
            {([
              [null, "Sin recargo"],
              ["monto", "$ fijo"],
              ["porcentaje", "% de la cuota"],
            ] as const).map(([k, label]) => (
              <button key={String(k)} type="button"
                onClick={() => { limpiar(); setCobro((c) => ({ ...c, recargo_tipo: k })); }}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                  (cobro.recargo_tipo ?? null) === k ? "border-brand/40 bg-[rgba(34,211,238,.12)] text-brand" : "border-white/10 text-ink-2 hover:text-ink"
                }`}>{label}</button>
            ))}
            {cobro.recargo_tipo && (
              <input type="number" min={0} className="input w-28"
                placeholder={cobro.recargo_tipo === "porcentaje" ? "Ej: 10" : "Ej: 5000"}
                value={cobro.recargo_valor ?? ""}
                onChange={(e) => { limpiar(); setCobro((c) => ({ ...c, recargo_valor: e.target.value === "" ? null : Number(e.target.value) })); }} />
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            {cobro.recargo_tipo
              ? "Al cobrarle a un socio atrasado, la pantalla te propone el monto con el recargo sumado. Siempre lo podés cambiar: no se cobra solo."
              : "Si algún socio paga tarde, le cobrás lo mismo de siempre."}
          </p>
        </div>

        <div className="border-t border-white/10 pt-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={clase.activa}
              onChange={(e) => { limpiar(); setClase((c) => ({ ...c, activa: e.target.checked })); }} />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-ink">Vender clases sueltas</span>
              <span className="block text-[11px] text-muted">
                Para el que quiere probar, o el socio que ya usó las de su plan y quiere una más.
                Aparece un botón en la ficha de cada socio.
              </span>
            </span>
          </label>
          {clase.activa && (
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
              <span className="text-xs text-ink-2">Precio sugerido $</span>
              <input type="number" min={0} className="input w-28" placeholder="Ej: 8000"
                value={clase.precio ?? ""}
                onChange={(e) => { limpiar(); setClase((c) => ({ ...c, precio: e.target.value === "" ? null : Number(e.target.value) })); }} />
              <span className="text-[11px] text-muted">Al venderla te lo trae puesto, pero lo podés cambiar.</span>
            </div>
          )}
        </div>

        <p className="border-t border-white/10 pt-3 text-[11px] text-muted">
          Ejemplo: a un socio que hoy está vencido, al cobrarle le va a quedar el{" "}
          <b className="text-ink-2">{fechaCorta(nuevoVencimiento("2000-01-01", cobro))}</b>.
        </p>
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

        {/* En pantalla grande queda fija al costado: al tocar un estilo o apagar
            una sección se ve el efecto sin perder de vista los controles. */}
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <PreviewSocio theme={theme} nombre={gym.name} logoUrl={gym.logo_url} ocultas={hiddenMember} />
          </div>
        </aside>
      </div>
    </div>
  );
}
