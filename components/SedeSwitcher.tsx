"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getActiveSedeId,
  resolveActiveSede,
  setActiveSedeId,
  SEDE_EVENT,
  recordarGym,
  type Sede,
} from "@/lib/sede";

/**
 * Selector de sucursal para la barra superior del panel.
 * Muestra la sede activa y deja cambiarla. Si el gimnasio tiene una sola sede
 * no se muestra nada (no molesta a quien no usa multi-sede).
 */
export default function SedeSwitcher({ role }: { role: string }) {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      // Un pedido en vez de tres. Este componente esta en la barra de TODAS las
      // pantallas del panel, asi que sus viajes se pagan en cada una — incluso
      // cuando termina sin mostrar nada porque el gimnasio tiene una sola sede.
      try {
        const r = await fetch("/api/panel/sedes");
        const j = await r.json();
        if (!j.ok || !j.gym_id) return;
        setGymId(j.gym_id);
        recordarGym(j.gym_id);
        const list = (j.sedes as Sede[]) || [];
        setSedes(list);
        setActiveId(resolveActiveSede(j.gym_id, list));
      } catch { /* sin sucursales el panel anda igual */ }
    })();
    /* eslint-disable-next-line */
  }, []);

  // Mantener sincronizado si otra vista cambia la sede activa.
  useEffect(() => {
    function onChange() {
      if (gymId) setActiveId(getActiveSedeId(gymId));
    }
    window.addEventListener(SEDE_EVENT, onChange);
    return () => window.removeEventListener(SEDE_EVENT, onChange);
  }, [gymId]);

  // Cerrar el popover al hacer click afuera.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!gymId || sedes.length < 2) return null;

  const active = sedes.find((s) => s.id === activeId);

  function choose(id: string) {
    if (!gymId) return;
    setActiveSedeId(gymId, id);
    setActiveId(id);
    setOpen(false);
    // Recargamos para que finanzas / dashboard / clases tomen la nueva sede.
    window.location.reload();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-[10px] border border-white/[.08] bg-surface px-3 py-2 text-[13px] font-semibold text-ink transition hover:border-white/20"
        title="Cambiar de sucursal"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-brand">
          <path d="M3 21h18M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-6h6v6" />
        </svg>
        <span className="max-w-[140px] truncate">{active?.name || "Sucursal"}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 opacity-70">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/[.1] bg-[#0c1017] shadow-2xl">
          <div className="px-3 pb-1.5 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[.9px] text-muted">Sucursal</div>
          <ul className="max-h-72 overflow-y-auto">
            {sedes.map((s) => {
              const on = s.id === activeId;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => choose(s.id)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-white/5 ${on ? "text-brand" : "text-ink"}`}
                  >
                    <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? "border-brand bg-brand text-[#04121a]" : "border-white/20"}`}>
                      {on && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-2.5 w-2.5"><path d="M5 12l5 5L20 6" /></svg>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{s.name}</span>
                      {s.address && <span className="block truncate text-xs text-muted">{s.address}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {role !== "empleado" && (
            <Link
              href="/dashboard/sedes"
              onClick={() => setOpen(false)}
              className="block border-t border-white/[.08] px-3 py-2.5 text-[13px] font-semibold text-ink-2 transition hover:bg-white/5 hover:text-brand"
            >
              + Administrar sucursales
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
