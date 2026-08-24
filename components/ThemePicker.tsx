"use client";

import { THEMES, type Theme } from "@/lib/theme";

/**
 * Selector de estilo de la app.
 *
 * Cada opción se dibuja con SU PROPIA paleta: el fondo, la tarjeta, los textos
 * y el botón del preview usan los colores reales de ese estilo. Un círculo de
 * color no alcanzaría, porque lo que cambia no es solo el acento sino toda la
 * base — y el dueño tiene que poder ver eso antes de elegir.
 *
 * Se usa en dos lados: el panel del dueño (Página pública) y el Super Admin
 * (para cambiarle el estilo a una demo antes de mostrarla).
 */
export default function ThemePicker({
  value,
  onChange,
  compact = false,
}: {
  value?: string | null;
  onChange: (key: string) => void;
  /** Versión chica, para tablas o paneles apretados. */
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-3"}`}>
      {THEMES.map((t) => (
        <Opcion key={t.key} t={t} activo={value === t.key} compact={compact} onPick={() => onChange(t.key)} />
      ))}
    </div>
  );
}

function Opcion({ t, activo, compact, onPick }: { t: Theme; activo: boolean; compact: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={activo}
      title={`${t.label} — ${t.desc}`}
      className={`group overflow-hidden rounded-xl border text-left transition ${
        activo ? "border-brand ring-1 ring-brand/40" : "border-white/10 hover:border-white/25"
      }`}
    >
      {/* Preview pintado con la paleta del propio estilo */}
      <div className={compact ? "p-2" : "p-2.5"} style={{ background: t.bg }}>
        <div
          className="rounded-lg border p-2"
          style={{ background: t.surface, borderColor: "rgba(255,255,255,.08)" }}
        >
          <div className="mb-1.5 h-1.5 w-3/5 rounded-full" style={{ background: t.ink }} />
          <div className="mb-2 h-1 w-4/5 rounded-full" style={{ background: t.ink2 }} />
          <div
            className="h-3.5 w-full rounded"
            style={{ background: `linear-gradient(135deg, rgb(${t.brandRgb}), rgb(${t.brand2Rgb}))` }}
          />
        </div>
      </div>

      <div className={`bg-surface ${compact ? "px-2 py-1.5" : "px-2.5 py-2"}`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${activo ? "text-brand" : "text-ink"}`}>{t.label}</span>
          {activo && <span className="text-[10px] text-brand">✓</span>}
        </div>
        {!compact && <p className="mt-0.5 text-[11px] leading-snug text-muted">{t.desc}</p>}
      </div>
    </button>
  );
}
