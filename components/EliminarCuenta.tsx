"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

/**
 * "Eliminar mi cuenta", desde adentro de la app.
 *
 * Lo exigen Google Play y la App Store para cualquier app con registro, y es un
 * derecho por la ley 25.326. Se monta en Mi cuenta (dueño) y en el perfil del
 * socio; el endpoint decide solo qué corresponde borrar según quién llama.
 *
 * Arranca cerrado, detrás de un enlace discreto: es una acción definitiva y no
 * tiene que competir con los botones que la gente usa todos los días. Antes de
 * confirmar se le muestra LO QUE SE PIERDE, con los números reales de su
 * cuenta — no un "esta acción es irreversible" genérico.
 */

interface Resumen {
  caso: "dueno" | "socio" | "empleado" | "suelto";
  gimnasio?: string | null;
  seBorra: Record<string, number>;
}

const ETIQUETAS: Record<string, string> = {
  socios: "socios", clases: "clases", reservas: "reservas",
  movimientos: "movimientos de caja", pesos: "registros de peso", rutinas: "rutinas",
};

export default function EliminarCuenta() {
  const supabase = createClient();
  const [abierto, setAbierto] = useState(false);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");

  async function abrir() {
    setAbierto(true);
    setError("");
    setCargando(true);
    try {
      const r = await fetch("/api/cuenta/eliminar");
      const j = await r.json();
      if (j.ok) setResumen({ caso: j.caso, gimnasio: j.gimnasio, seBorra: j.seBorra || {} });
      else setError(j.error || "No pudimos cargar tu cuenta.");
    } catch {
      setError("Falló la conexión. Probá de nuevo.");
    }
    setCargando(false);
  }

  async function eliminar() {
    setBorrando(true);
    setError("");
    try {
      const r = await fetch("/api/cuenta/eliminar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmacion }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error || "No se pudo eliminar la cuenta.");
        setBorrando(false);
        return;
      }
      // La cuenta ya no existe: cerramos sesión y afuera.
      await supabase.auth.signOut().catch(() => {});
      window.location.href = "/acceso?cuenta=eliminada";
    } catch {
      setError("Falló la conexión. Probá de nuevo.");
      setBorrando(false);
    }
  }

  const esDueno = resumen?.caso === "dueno";
  const listo = !esDueno || confirmacion.trim().toLowerCase() === String(resumen?.gimnasio || "").trim().toLowerCase();
  const items = Object.entries(resumen?.seBorra || {}).filter(([, n]) => n > 0);

  if (!abierto) {
    return (
      <button onClick={abrir} className="text-xs text-muted underline underline-offset-2 transition hover:text-crit">
        Eliminar mi cuenta
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-crit/30 bg-[rgba(240,82,82,.06)] p-4">
      <h3 className="text-sm font-semibold text-crit">Eliminar mi cuenta</h3>

      {cargando ? (
        <p className="mt-2 text-sm text-ink-2">Revisando tu cuenta…</p>
      ) : (
        <>
          <p className="mt-1.5 text-sm text-ink-2">
            {esDueno ? (
              <>
                Se elimina <b className="text-ink">{resumen?.gimnasio}</b> y todo lo que tiene
                adentro, incluidas las cuentas de acceso de tus socios. Es definitivo: no se puede
                recuperar.
              </>
            ) : resumen?.caso === "socio" ? (
              <>
                Se eliminan tu acceso y tus datos personales. Los pagos que ya hiciste quedan
                registrados en el gimnasio, sin tu nombre. Es definitivo.
              </>
            ) : (
              <>Se eliminan tu acceso y tu perfil. El negocio no se toca. Es definitivo.</>
            )}
          </p>

          {items.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/10 bg-surface px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wide text-muted">Se borra</div>
              <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
                {items.map(([k, n]) => (
                  <li key={k}>
                    <b className="tabular-nums text-ink">{n}</b> {ETIQUETAS[k] || k}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {esDueno && (
            <>
              {/* Escribir el nombre es a propósito: obliga a leer qué se borra. */}
              <label className="mt-3 block text-xs text-ink-2">
                Para confirmar, escribí <b className="text-ink">{resumen?.gimnasio}</b>
              </label>
              <input
                className="input mt-1.5"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                placeholder={resumen?.gimnasio || ""}
                autoComplete="off"
              />
              <p className="mt-2 text-[11px] text-muted">
                Si tenés un abono al día, eliminar tu cuenta no te devuelve el mes en curso.
              </p>
            </>
          )}

          {error && <p className="mt-3 text-sm text-crit">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn text-xs"
              style={{ background: "#b02b1c", color: "#fff" }}
              disabled={!listo || borrando}
              onClick={eliminar}
            >
              {borrando ? "Eliminando…" : "Sí, eliminar para siempre"}
            </button>
            <button
              className="btn btn-ghost text-xs"
              disabled={borrando}
              onClick={() => { setAbierto(false); setConfirmacion(""); setError(""); }}
            >
              Mejor no
            </button>
          </div>
        </>
      )}
    </div>
  );
}
