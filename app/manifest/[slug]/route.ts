import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { themeOf } from "@/lib/theme";

/**
 * El manifest de la app instalada, uno por gimnasio.
 *
 * Antes había un solo `public/manifest.json` escrito a mano: la socia de
 * DanzArte se instalaba la app y le quedaba el ícono y el nombre de TurnoGym en
 * el teléfono. Ahora cada negocio tiene el suyo, con su nombre, su ícono y sus
 * colores — y es también la base de la app que se sube a las tiendas.
 *
 * Es PÚBLICO a propósito: el navegador lo pide sin la sesión del usuario, así
 * que no puede depender de estar logueado. Por eso se lee con el service role,
 * acotado a ese gimnasio y a las cuatro columnas que hacen falta.
 */
export const runtime = "nodejs";

/** Los de TurnoGym, para el que todavía no subió el suyo. */
const ICONOS_POR_DEFECTO = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
];

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const slug = String(params.slug || "").trim();

  let nombre = "turnogym";
  let icono: string | null = null;
  let tema = themeOf(null);

  if (url && key && slug) {
    const admin = createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data } = await admin
      .from("gyms").select("name, app_icon_url, logo_url, theme").eq("slug", slug)
      .maybeSingle<{ name: string | null; app_icon_url: string | null; logo_url: string | null; theme: string | null }>();
    if (data) {
      nombre = (data.name || "turnogym").trim();
      // El ícono de la app gana; si no cargó uno, probamos con el logo.
      icono = data.app_icon_url || data.logo_url || null;
      tema = themeOf(data.theme);
    }
  }

  // El nombre corto es el que entra abajo del ícono en el teléfono: 12
  // caracteres es lo que muestra Android antes de cortar con puntos.
  const corto = nombre.length <= 12 ? nombre : nombre.slice(0, 12).trim();

  const manifest = {
    name: nombre,
    short_name: corto,
    description: `Tus clases, tu rutina y tu progreso en ${nombre}.`,
    // Arranca en el portal del socio: es la app del socio, no el panel.
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: tema.bg,
    theme_color: tema.bg,
    lang: "es-AR",
    icons: icono
      ? [
          // Una sola imagen declarada en los dos tamaños: el navegador la
          // reescala. Por eso en "Mi cuenta" se pide cuadrada y de 512 o más.
          { src: icono, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: icono, sizes: "512x512", type: "image/png", purpose: "any" },
        ]
      : ICONOS_POR_DEFECTO,
  };

  return NextResponse.json(manifest, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      // Un rato en el borde, pero que revalide: si cambia el ícono, el socio
      // no tiene que esperar un día para verlo.
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
