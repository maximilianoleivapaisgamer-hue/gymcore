import { createClient as createAdmin } from "@supabase/supabase-js";
import { nombreLimpio } from "@/lib/marca";
import { slugValido } from "@/lib/app-nativa";

/**
 * La marca de un gimnasio, para pintarla ANTES de que la persona inicie sesión.
 *
 * Existe por la pantalla de acceso de las apps de tienda. El socio de DanzArte
 * abre "DanzArte" en el teléfono y tiene que ver DanzArte, no una pantalla
 * genérica de turnogym donde no sabe si se equivocó de app.
 *
 * Y no es solo estética: la revisión de Apple mira seis apps que abren todas en
 * la misma pantalla idéntica y las marca como la misma app repetida (regla 4.3).
 *
 * Se lee con el service role, igual que el manifest, porque quien mira esto
 * TODAVÍA NO tiene sesión. Por eso devuelve **solo lo que ya es público** —
 * nombre, logo y colores, lo mismo que cualquiera ve en la página web del
 * gimnasio. Nada de acá sirve para deducir socios, plata ni teléfonos.
 */

export interface MarcaGimnasio {
  slug: string;
  nombre: string;
  /** El ícono de la app; si no cargó ninguno, el logo; si tampoco, null. */
  logo: string | null;
  tema: string | null;
  fondo: string | null;
}

export async function marcaPorSlug(slug?: string | null): Promise<MarcaGimnasio | null> {
  const limpio = String(slug || "").trim();
  if (!limpio || !slugValido(limpio)) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const admin = createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin
    .from("gyms")
    .select("slug, name, app_icon_url, logo_url, theme, bg_style")
    .eq("slug", limpio)
    .maybeSingle<{
      slug: string; name: string | null; app_icon_url: string | null;
      logo_url: string | null; theme: string | null; bg_style: string | null;
    }>();
  if (!data) return null;

  return {
    slug: data.slug,
    nombre: nombreLimpio(data.name),
    logo: data.app_icon_url || data.logo_url || null,
    tema: data.theme,
    fondo: data.bg_style,
  };
}

/**
 * La inicial del gimnasio, para cuando no cargó ni ícono ni logo.
 *
 * Es el mismo recurso que usan las tarjetas de clase sin foto: queda prolijo y
 * sigue siendo distinto en cada gimnasio, que es lo que importa acá.
 */
export function inicialDe(nombre: string): string {
  return (nombre.trim()[0] || "T").toUpperCase();
}
