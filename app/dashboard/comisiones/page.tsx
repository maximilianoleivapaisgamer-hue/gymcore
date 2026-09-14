"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { allows, loadPlans, loadGymExtras, type PlanConfig } from "@/lib/plans";

/**
 * Cuánto le toca a cada profe a fin de mes.
 *
 * ── LA REGLA, como la definió DanzArte ──────────────────────────────────
 *
 *   "50% queda DanzArte, el resto se divide por profesor según cantidad de
 *    clases, para que sea equitativo. Y el porcentaje sí, por ahora 50%; para
 *    los profesores nuevos es 40%."
 *
 * Socio por socio: lo que pagó se reparte entre las profes según cuántas clases
 * hizo con cada una, y cada profe cobra SU porcentaje de esa parte.
 *
 * La pantalla muestra el número Y de dónde sale, porque acá se está repartiendo
 * plata de verdad entre personas: un total sin explicación no lo va a poder
 * defender frente a sus profes.
 */

interface Profe {
  nombre: string; porcentaje: number; clases: number; socios: number;
  atribuido: number; comision: number; cargada: boolean;
}
interface SinAsignar { plata: number; socios: { member_id: string; nombre: string; pago: number }[] }
interface Datos {
  mes: string; cobrado: number; a_pagar: number; queda_para_el_gimnasio: number;
  profes: Profe[]; sin_asignar: SinAsignar;
}

const plata = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

/** "2026-09" → "septiembre de 2026" */
function mesLargo(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

/** Los últimos 12 meses, para el selector. */
function ultimosMeses(): string[] {
  const hoy = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export default function ComisionesPage() {
  const supabase = createClient();
  const [mes, setMes] = useState(ultimosMeses()[0]);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [plans, setPlans] = useState<PlanConfig[] | null>(null);
  const [plan, setPlan] = useState<string | undefined>();
  const [extras, setExtras] = useState<string[]>([]);
  const [habilitado, setHabilitado] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [verSinAsignar, setVerSinAsignar] = useState(false);
  const [gymId, setGymId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: perfil } = await supabase
        .from("profiles").select("gym_id").eq("id", user.id).maybeSingle<{ gym_id: string | null }>();
      if (!perfil?.gym_id) { setHabilitado(false); return; }
      setGymId(perfil.gym_id);
      const { data: sub } = await supabase
        .from("subscriptions").select("plan").eq("gym_id", perfil.gym_id).maybeSingle<{ plan: string }>();
      const p = await loadPlans(supabase);
      const ex = await loadGymExtras(supabase, perfil.gym_id);
      setPlans(p); setPlan(sub?.plan); setExtras(ex);
      setHabilitado(allows(p, sub?.plan, "comisiones", ex));
    })();
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    if (habilitado !== true) return;
    setCargando(true);
    fetch(`/api/panel/comisiones?mes=${mes}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setDatos(j as Datos); })
      .catch(() => { /* la pantalla queda en su estado vacío */ })
      .finally(() => setCargando(false));
  }, [mes, habilitado]);

  /** Cambiar el porcentaje de una profe. Se guarda apenas sale del campo. */
  async function guardarPorcentaje(nombre: string, valor: number) {
    if (!gymId || !Number.isFinite(valor) || valor < 0 || valor > 100) return;
    setGuardando(nombre);
    try {
      const g = await fetch("/api/panel/comisiones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre, porcentaje: valor }),
      });
      const gj = await g.json();
      if (!gj.ok) { setError(gj.error || "No se pudo guardar el porcentaje."); setGuardando(null); return; }
      setError("");
      // Se vuelve a pedir: cambiar un porcentaje cambia todos los totales.
      const r = await fetch(`/api/panel/comisiones?mes=${mes}`);
      const j = await r.json();
      if (j.ok) setDatos(j as Datos);
    } catch {
      setError("No se pudo guardar el porcentaje. Probá de nuevo.");
    }
    setGuardando(null);
  }

  const meses = useMemo(ultimosMeses, []);

  if (habilitado === false) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="mb-2 text-4xl">📊</div>
        <h1 className="text-2xl font-bold">Comisiones está en los planes Pro y Elite</h1>
        <p className="mt-2 text-ink-2">
          Calcula sola cuánto le toca a cada profe a fin de mes, repartiendo lo que
          pagó cada socio según las clases que hizo con cada una. Se acabó la
          planilla.
        </p>
        <Link href="/dashboard/mi-plan" className="btn btn-primary mt-5 inline-block">Ver planes</Link>
      </main>
    );
  }

  return (
    <main className="p-5 md:p-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link>
            <span>/</span><span className="text-ink">Comisiones</span>
          </div>
          <h1 className="text-2xl font-bold tracking-[-.5px]">Comisiones de profes</h1>
          <p className="mt-1 text-sm text-ink-2">
            Lo que pagó cada socio se reparte según las clases que hizo con cada profe.
          </p>
        </div>
        <select className="input w-auto" value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => <option key={m} value={m}>{mesLargo(m)}</option>)}
        </select>
      </div>

      {cargando && <p className="text-ink-2">Calculando…</p>}

      {!cargando && datos && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Dato titulo="Cobrado en el mes" valor={plata(datos.cobrado)} />
            <Dato titulo="A pagar a las profes" valor={plata(datos.a_pagar)} tono="text-warn" />
            <Dato titulo="Queda en el gimnasio" valor={plata(datos.queda_para_el_gimnasio)} tono="text-good" />
          </div>

          {error && (
            <p className="mb-3 rounded-lg border border-crit/30 bg-[rgba(240,82,82,.1)] px-3 py-2 text-sm text-crit">
              {error}
            </p>
          )}

          {datos.profes.length === 0 ? (
            <div className="card text-center text-ink-2">
              <p className="font-semibold text-ink">Todavía no hay nada para repartir en {mesLargo(datos.mes)}.</p>
              <p className="mt-1 text-sm">
                Se necesitan clases con la profe cargada y socios que hayan reservado.
                Cargá la profe en <Link href="/dashboard/clases" className="text-brand">Clases</Link>.
              </p>
            </div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-semibold">Profe</th>
                    <th className="px-4 py-3 text-right font-semibold">Clases</th>
                    <th className="px-4 py-3 text-right font-semibold">Socios</th>
                    <th className="px-4 py-3 text-right font-semibold">Le corresponde</th>
                    <th className="px-4 py-3 text-right font-semibold">Su %</th>
                    <th className="px-4 py-3 text-right font-semibold">A cobrar</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.profes.map((p) => (
                    <tr key={p.nombre} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{p.nombre}</div>
                        {!p.cargada && (
                          <div className="text-[11px] text-muted">con el 50% por defecto</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-2">{p.clases}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-2">{p.socios}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-2">{plata(p.atribuido)}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number" min={0} max={100} step={1}
                          defaultValue={p.porcentaje}
                          disabled={guardando === p.nombre}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== p.porcentaje) guardarPorcentaje(p.nombre, v);
                          }}
                          className="input w-[72px] py-1 text-right tabular-nums"
                          title="Lo que se lleva ella. Las nuevas suelen ir al 40%."
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-base font-bold tabular-nums text-brand">
                        {guardando === p.nombre ? "…" : plata(p.comision)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {datos.sin_asignar.plata > 0 && (
            <div className="mt-5 rounded-xl border border-[#f5b13d]/30 bg-[rgba(245,177,61,.08)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#f5b13d]">
                    {plata(datos.sin_asignar.plata)} sin profe asignada
                  </div>
                  <p className="mt-1 text-xs leading-snug text-ink-2">
                    {datos.sin_asignar.socios.length}{" "}
                    {datos.sin_asignar.socios.length === 1 ? "socio pagó" : "socios pagaron"} y
                    no reservaron ninguna clase este mes, así que esa plata no se le
                    atribuye a nadie. <b>Es plata que se te puede ir</b>: si están
                    pagando y no vienen, conviene llamarlos.
                  </p>
                </div>
                <button className="btn btn-ghost shrink-0 text-xs"
                  onClick={() => setVerSinAsignar((v) => !v)}>
                  {verSinAsignar ? "Ocultar" : "Ver quiénes"}
                </button>
              </div>

              {verSinAsignar && (
                <ul className="mt-3 divide-y divide-white/5 border-t border-white/10 pt-1">
                  {datos.sin_asignar.socios.map((s) => (
                    <li key={s.member_id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/dashboard/socios/${s.member_id}`} className="hover:text-brand">
                        {s.nombre}
                      </Link>
                      <span className="tabular-nums text-ink-2">{plata(s.pago)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="mt-5 text-xs leading-relaxed text-muted">
            Se cuentan las <b>reservas</b> del mes. Como una clase reservada y no
            cancelada a tiempo ya se le descuenta al socio, cuenta como clase dada.
            El porcentaje de cada profe se guarda solo al cambiarlo.
          </p>
        </>
      )}
    </main>
  );
}

function Dato({ titulo, valor, tono = "text-ink" }: { titulo: string; valor: string; tono?: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-muted">{titulo}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tono}`}>{valor}</div>
    </div>
  );
}
