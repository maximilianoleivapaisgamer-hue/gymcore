"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

/**
 * Puesta en marcha: qué le falta configurar a ESTE negocio.
 *
 * No es un tour ni un cartel de bienvenida. Lee la base y dice lo que falta de
 * verdad, con el dato real al lado ("16 clases cargadas"). Se tilda solo y
 * desaparece cuando está completo, así no molesta al que ya arrancó.
 *
 * Los pasos de una sección apagada no se muestran: un personal trainer que no
 * usa Clases no tiene por qué ver "cargá tus clases" para siempre.
 */

interface Paso {
  clave: string;
  titulo: string;
  href: string;
  /** Sección de `hidden_sections` que lo vuelve irrelevante si está apagada. */
  seccion?: string;
  hecho: boolean;
  /** Lo que se muestra al lado: "3 cargados" o el empujón para arrancar. */
  detalle: string;
}

const OCULTO = "tg_primeros_pasos_oculto";

export default function PrimerosPasos() {
  const supabase = createClient();
  const [pasos, setPasos] = useState<Paso[] | null>(null);
  const [oculto, setOculto] = useState(true); // hasta saber, no parpadea

  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem(OCULTO) === "1") return;
      } catch {
        /* navegador sin storage: lo mostramos igual */
      }
      setOculto(false);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: perfil } = await supabase
        .from("profiles").select("gym_id, role").eq("id", user.id)
        .single<{ gym_id: string | null; role: string }>();
      // A los empleados no les corresponde configurar el negocio.
      if (!perfil?.gym_id || perfil.role === "empleado") return;
      const gymId = perfil.gym_id;

      // select("*") para que no explote si falta correr alguna migración.
      const { data: gym } = await supabase.from("gyms").select("*").eq("id", gymId).maybeSingle();
      const g = (gym || {}) as {
        real_plans?: unknown[] | null;
        logo_url?: string | null;
        landing_config?: unknown | null;
        hidden_sections?: string[] | null;
      };

      const solaCuenta = { count: "exact" as const, head: true };
      const [{ count: clases }, { count: socios }, { count: cobros }] = await Promise.all([
        supabase.from("classes").select("id", solaCuenta).eq("gym_id", gymId),
        supabase.from("members").select("id", solaCuenta).eq("gym_id", gymId),
        supabase.from("cashflow_entries").select("id", solaCuenta).eq("gym_id", gymId).eq("type", "income"),
      ]);

      const planes = Array.isArray(g.real_plans) ? g.real_plans.length : 0;

      setPasos([
        {
          clave: "planes", titulo: "Cargá tus planes y precios", href: "/dashboard/planes",
          hecho: planes > 0,
          detalle: planes > 0 ? `${planes} ${planes === 1 ? "plan cargado" : "planes cargados"}` : "Es lo primero: de acá salen los montos que cobrás",
        },
        {
          clave: "clases", titulo: "Cargá tus clases", href: "/dashboard/clases", seccion: "clases",
          hecho: (clases ?? 0) > 0,
          detalle: (clases ?? 0) > 0 ? `${clases} ${(clases ?? 0) === 1 ? "clase cargada" : "clases cargadas"}` : "Una fila por horario, con día, hora y cupo",
        },
        {
          clave: "socios", titulo: "Sumá tus primeros socios", href: "/dashboard/socios",
          hecho: (socios ?? 0) > 0,
          detalle: (socios ?? 0) > 0 ? `${socios} ${(socios ?? 0) === 1 ? "socio cargado" : "socios cargados"}` : "Con el nombre y el DNI alcanza para empezar",
        },
        {
          clave: "cobro", titulo: "Registrá tu primer cobro", href: "/dashboard/socios", seccion: "finanzas",
          hecho: (cobros ?? 0) > 0,
          detalle: (cobros ?? 0) > 0 ? `${cobros} ${(cobros ?? 0) === 1 ? "cobro registrado" : "cobros registrados"}` : "Desde la ficha del socio, botón Cobrar",
        },
        {
          clave: "logo", titulo: "Poné tu logo y tus colores", href: "/dashboard/ajustes",
          hecho: !!g.logo_url,
          detalle: g.logo_url ? "Listo, tu marca ya está" : "Tus socios ven tu marca en su app, no la nuestra",
        },
        {
          clave: "web", titulo: "Armá tu página web", href: "/dashboard/configuracion", seccion: "configuracion",
          hecho: !!g.landing_config,
          detalle: g.landing_config ? "Publicada" : "Un link con tu marca para mandar por WhatsApp",
        },
      ].filter((p) => !p.seccion || !(g.hidden_sections || []).includes(p.seccion)));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cerrar() {
    try { localStorage.setItem(OCULTO, "1"); } catch { /* da igual */ }
    setOculto(true);
  }

  if (oculto || !pasos || pasos.length === 0) return null;

  const listos = pasos.filter((p) => p.hecho).length;
  // Completo = no molesta más. El que ya configuró todo no necesita el cartel.
  if (listos === pasos.length) return null;

  const proximo = pasos.find((p) => !p.hecho);

  return (
    <div className="mb-5 card border-brand/25">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Puesta en marcha</h2>
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand">
              {listos} de {pasos.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-2">
            {proximo ? <>Lo que sigue: <b className="text-ink">{proximo.titulo.toLowerCase()}</b>.</> : null}
          </p>
        </div>
        <button onClick={cerrar} className="shrink-0 text-xs text-muted transition hover:text-ink-2">
          Ocultar
        </button>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full transition-all"
          style={{
            width: `${(listos / pasos.length) * 100}%`,
            background: "linear-gradient(90deg, rgb(var(--brand-rgb)), rgb(var(--brand-2-rgb)))",
          }} />
      </div>

      <ul className="flex flex-col gap-1">
        {pasos.map((p) => (
          <li key={p.clave}>
            {p.hecho ? (
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 opacity-55">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgba(74,222,128,.16)] text-[#4ade80]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <span className="min-w-0 truncate text-[13px] line-through decoration-white/25">{p.titulo}</span>
                <span className="ml-auto shrink-0 text-[11px] text-muted">{p.detalle}</span>
              </div>
            ) : (
              <Link href={p.href}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-white/[.04]">
                <span className="h-5 w-5 shrink-0 rounded-full border border-white/20" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{p.titulo}</span>
                  <span className="block truncate text-[11px] text-muted">{p.detalle}</span>
                </span>
                <span className="ml-auto shrink-0 text-brand">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
