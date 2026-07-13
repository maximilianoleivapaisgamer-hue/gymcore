"use client";

import { useState } from "react";

/**
 * Selector de fecha propio (calendario en grilla). Reemplaza al input date
 * nativo: mostrás la fecha en dd/mm/aaaa y elegís el día tocando el calendario.
 * value/onChange usan formato ISO "aaaa-mm-dd" (o "" si está vacío).
 */
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toIso(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function fmt(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Elegí una fecha",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const base = value ? value.split("-").map(Number) : null;
  const [view, setView] = useState(() =>
    base ? { y: base[0], m: base[1] - 1 } : { y: today.getFullYear(), m: today.getMonth() }
  );

  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  function prev() { setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 })); }
  function next() { setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 })); }
  function pick(d: number) { onChange(toIso(view.y, view.m, d)); setOpen(false); }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between text-left"
      >
        <span className={value ? "" : "text-muted"}>{value ? fmt(value) : placeholder}</span>
        <span className="text-ink-2" aria-hidden="true">📅</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 w-72 rounded-xl border border-white/10 bg-surface p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={prev}
                className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 hover:border-white/25">‹</button>
              <div className="text-sm font-semibold">{MESES[view.m]} {view.y}</div>
              <button type="button" onClick={next}
                className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 hover:border-white/25">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
              {DIAS.map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) =>
                d === null ? (
                  <div key={i} />
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(d)}
                    className={`h-8 rounded-lg text-sm transition ${
                      value === toIso(view.y, view.m, d)
                        ? "bg-brand font-semibold text-black"
                        : todayIso === toIso(view.y, view.m, d)
                        ? "border border-brand/40 text-ink hover:bg-white/5"
                        : "text-ink-2 hover:bg-white/5 hover:text-ink"
                    }`}
                  >
                    {d}
                  </button>
                )
              )}
            </div>
            <div className="mt-2 flex justify-between">
              <button type="button" className="text-xs text-ink-2 hover:text-ink"
                onClick={() => { onChange(todayIso); setOpen(false); }}>Hoy</button>
              {value && (
                <button type="button" className="text-xs text-ink-2 hover:text-crit"
                  onClick={() => { onChange(""); setOpen(false); }}>Borrar</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
