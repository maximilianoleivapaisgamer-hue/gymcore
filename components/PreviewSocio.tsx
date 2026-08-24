"use client";

import { themeOf } from "@/lib/theme";

/**
 * Vista previa de la app del SOCIO con el estilo elegido.
 *
 * Va al lado del selector de estilo para que el dueño no tenga que imaginarse
 * nada: toca un estilo y ve cómo le queda la app a sus clientes, con el nombre
 * y el logo de su propio negocio.
 *
 * Refleja las DOS configuraciones de la pantalla: los colores del estilo y las
 * secciones que el dueño le dejó prendidas al socio. Si apaga Rutina, acá
 * desaparece; si apaga Clases, cambia hasta la tarjeta principal. Así lo que ve
 * es el resultado real, no una maqueta genérica.
 *
 * Se dibuja con los colores del tema pasado por parámetro (estilos inline), NO
 * con las clases de Tailwind: si usara las clases mostraría el estilo que está
 * aplicado en ese momento, no el que se está previsualizando.
 *
 * Está en un marco de teléfono a propósito: el socio entra desde el celular,
 * y verlo en ese formato es más honesto que un rectángulo suelto.
 */
export default function PreviewSocio({
  theme,
  nombre,
  logoUrl,
  ocultas = [],
}: {
  theme?: string | null;
  nombre?: string | null;
  logoUrl?: string | null;
  /** Claves de MEMBER_SECTIONS que el dueño le apagó al socio. */
  ocultas?: string[];
}) {
  const t = themeOf(theme);
  const ve = (k: string) => !ocultas.includes(k);

  // El carnet QR y el progreso no se pueden apagar: siempre los tiene.
  const accesos = [
    ve("rutina") ? { l: "Rutina", d: "M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" } : null,
    ve("dieta") ? { l: "Dieta", d: "M3.5 11h17a8.5 8.5 0 0 1-17 0ZM12 11c0-4 3-7 7.5-7" } : null,
    ve("clases") ? { l: "Clases", d: "M3 4.5h18v16H3zM3 9h18M8 2.5v4M16 2.5v4" } : null,
    { l: "Carnet", d: "M4 4h7v7H4zM4 15h4v4H4zM13 4h4v4h-4zM13 13h3v3M20 4v6M13 20h7" },
  ].filter(Boolean) as { l: string; d: string }[];
  const marca = `linear-gradient(135deg, rgb(${t.brandRgb}), rgb(${t.brand2Rgb}))`;
  const borde = "rgba(255,255,255,.08)";
  const gym = (nombre || "Tu negocio").trim();

  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-ink-2">Así la ven tus socios</div>

      {/* Marco del teléfono */}
      <div
        className="mx-auto w-full max-w-[260px] overflow-hidden rounded-[26px] border-[6px] p-0 shadow-lg shadow-black/40"
        style={{ borderColor: "#232a36", background: t.bg }}
        aria-label={`Vista previa de la app del socio con el estilo ${t.label}`}
      >
        {/* Muesca */}
        <div className="flex justify-center pt-1.5">
          <div className="h-1 w-12 rounded-full" style={{ background: "rgba(255,255,255,.16)" }} />
        </div>

        <div className="space-y-2 p-2.5">
          {/* Encabezado con la marca del negocio */}
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain"
                style={{ background: "rgba(255,255,255,.06)" }} />
            ) : (
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
                style={{ background: marca, color: t.onBrand }}>
                {gym.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold leading-tight" style={{ color: t.ink }}>{gym}</div>
              <div className="text-[9px] leading-tight" style={{ color: t.muted }}>Hola, Martina</div>
            </div>
          </div>

          {/* La tarjeta principal depende de lo que le haya dejado prendido */}
          <div className="rounded-xl border p-2" style={{ background: t.surface, borderColor: borde }}>
            {ve("clases") ? (
              <>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: t.muted }}>Tu próxima clase</div>
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: t.ink }}>Pilates Reformer</div>
                <div className="text-[9px]" style={{ color: t.ink2 }}>Mañana · 09:00 · Con María</div>
                <div className="mt-1.5 rounded-md py-1 text-center text-[10px] font-bold"
                  style={{ background: marca, color: t.onBrand }}>Reservar</div>
              </>
            ) : ve("rutina") ? (
              <>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: t.muted }}>Tu rutina de hoy</div>
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: t.ink }}>Día 2 · Tren superior</div>
                <div className="text-[9px]" style={{ color: t.ink2 }}>6 ejercicios · 45 min</div>
                <div className="mt-1.5 rounded-md py-1 text-center text-[10px] font-bold"
                  style={{ background: marca, color: t.onBrand }}>Empezar</div>
              </>
            ) : (
              <>
                <div className="text-[9px] uppercase tracking-wide" style={{ color: t.muted }}>Tu carnet</div>
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: t.ink }}>Al día</div>
                <div className="text-[9px]" style={{ color: t.ink2 }}>Vence el 20/09</div>
                <div className="mt-1.5 rounded-md py-1 text-center text-[10px] font-bold"
                  style={{ background: marca, color: t.onBrand }}>Ver mi QR</div>
              </>
            )}
          </div>

          {/* El cupo del plan solo tiene sentido si reserva clases */}
          {ve("clases") && (
            <div className="rounded-lg border px-2 py-1.5" style={{ background: t.surface2, borderColor: borde }}>
              <div className="text-[9px]" style={{ color: t.ink2 }}>
                Te quedan <span style={{ color: t.ink, fontWeight: 700 }}>3</span> de 8 clases este mes
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.10)" }}>
                <div className="h-full rounded-full" style={{ width: "62%", background: marca }} />
              </div>
            </div>
          )}

          {/* Accesos de la app */}
          <div className={`grid gap-1.5 ${accesos.length >= 4 ? "grid-cols-4" : accesos.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {accesos.map((x) => (
              <div key={x.l} className="rounded-lg border py-1.5 text-center"
                style={{ background: t.surface, borderColor: borde }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={`rgb(${t.brandRgb})`} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="mx-auto h-3.5 w-3.5" aria-hidden="true">
                  <path d={x.d} />
                </svg>
                <div className="mt-0.5 text-[8px]" style={{ color: t.ink2 }}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-muted">
        Tu panel usa los mismos colores.
      </p>
    </div>
  );
}
