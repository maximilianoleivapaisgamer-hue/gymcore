import DemoChooser from "@/components/DemoChooser";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Link de prueba de UNA demo puntual: /demo/<slug>. Muestra la pantalla para
 * elegir dueño o socio, apuntando a esa demo. Es el link que se le manda al
 * prospecto junto con el de su web.
 */
export default async function DemoSlugPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  let nombre = "";
  let logoUrl: string | null = null;
  try {
    const supa = createClient();
    const { data } = await supa.from("gyms").select("name, is_demo, logo_url").eq("slug", slug).maybeSingle<{ name: string; is_demo: boolean; logo_url: string | null }>();
    if (data?.is_demo) { nombre = data.name || ""; logoUrl = data.logo_url || null; }
  } catch { /* si no se puede leer, mostramos genérico */ }

  const owner = `/demo/entrar?slug=${encodeURIComponent(slug)}&rol=owner`;
  const socio = `/demo/entrar?slug=${encodeURIComponent(slug)}&rol=socio`;
  return <DemoChooser nombre={nombre} logoUrl={logoUrl} ownerHref={owner} socioHref={socio} />;
}
