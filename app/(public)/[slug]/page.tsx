import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { Gym } from "@/types/db";
import { resolveLandingConfig } from "@/lib/landing-config";
import LandingSite from "@/components/landing/site/LandingSite";
import DemoVisitPing from "@/components/DemoVisitPing";
import "../landing.css";

/**
 * Landing pública white-label del gimnasio: turnogym.app/<slug>
 * Server Component: lee el gimnasio por slug (lectura pública por RLS), resuelve
 * su config de landing (demo + identidad + ediciones) y renderiza la plantilla
 * definitiva. Las fuentes de la plantilla (Space Grotesk + Inter) se cargan acá
 * y se scopean vía las variables CSS que usa landing.css.
 */

const inter = Inter({ subsets: ["latin"], variable: "--font-inter-landing", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk-landing", display: "swap" });

async function getGym(slug: string): Promise<Gym | null> {
  const supabase = createClient();
  const { data } = await supabase.from("gyms").select("*").eq("slug", slug).single<Gym>();
  return data ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const gym = await getGym(params.slug);
  if (!gym) return { title: "Gimnasio no encontrado" };
  const cfg = resolveLandingConfig(gym);
  return {
    title: `${cfg.nombre} — ${cfg.tagline}`,
    description: cfg.descripcion,
    openGraph: {
      title: cfg.nombre,
      description: cfg.descripcion,
      siteName: cfg.nombre,
      locale: "es_AR",
      type: "website",
      ...(gym.hero_url ? { images: [gym.hero_url] } : {}),
    },
  };
}

export default async function GymLanding({ params }: { params: { slug: string } }) {
  const gym = await getGym(params.slug);
  if (!gym) notFound();

  if (gym.demo_suspended) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0f16] px-6 text-center text-[#e6edf3]">
        <div className="max-w-md">
          <div className="mb-3 text-4xl">🚧</div>
          <h1 className="text-2xl font-bold">Esta página no está disponible</h1>
          <p className="mt-2 text-[#94a3b8]">La demo fue pausada. Si sos el dueño, contactanos para reactivarla.</p>
        </div>
      </main>
    );
  }

  const config = resolveLandingConfig(gym);

  return (
    <div className={`${inter.variable} ${grotesk.variable}`}>
      {gym.is_demo && <DemoVisitPing gymId={gym.id} kind="web" />}
      <LandingSite config={config} slug={gym.slug} />
    </div>
  );
}
