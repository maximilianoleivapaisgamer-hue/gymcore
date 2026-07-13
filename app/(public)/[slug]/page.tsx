import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Gym } from "@/types/db";
import { combinedLandingPlans, visibleLandingSections } from "@/lib/landing";
import ClasicaLanding from "@/components/landing/ClasicaLanding";
import ModernaLanding from "@/components/landing/ModernaLanding";

/**
 * Landing publica white-label del gimnasio: gymcore.app/<slug>
 * Server Component: lee el gimnasio por slug (lectura publica por RLS) y
 * despacha a la plantilla que el dueno eligio en /dashboard/configuracion,
 * con las secciones opcionales ya filtradas y ordenadas.
 */
export default async function GymLanding({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();
  const { data: gym } = await supabase
    .from("gyms")
    .select("*")
    .eq("slug", params.slug)
    .single<Gym>();

  if (!gym) notFound();

  const plans = combinedLandingPlans(gym);
  const sections = visibleLandingSections(gym, plans);

  if (gym.landing_template === "moderna") {
    return <ModernaLanding gym={gym} plans={plans} sections={sections} />;
  }
  return <ClasicaLanding gym={gym} plans={plans} sections={sections} />;
}
