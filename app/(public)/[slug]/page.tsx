import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Gym, MemberPlan } from "@/types/db";

/**
 * Landing pública white-label del gimnasio: gymcore.app/<slug>
 * Es un Server Component: lee el gimnasio por slug desde Supabase (lectura pública
 * permitida por RLS) y arma la página con el branding cargado por el dueño.
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

  const accent = gym.accent_color || "#22d3ee";
  const plans: MemberPlan[] = gym.member_plans || [];

  return (
    <main style={{ "--accent": accent } as React.CSSProperties} className="bg-bg text-ink">
      {/* HERO */}
      <section className="relative overflow-hidden px-6 py-20 text-center">
        {gym.hero_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${gym.hero_url})` }}
          />
        )}
        <div
          className="pointer-events-none absolute left-1/2 top-[-40%] h-[520px] w-[520px] -translate-x-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${accent}44, transparent 60%)` }}
        />
        <div className="relative z-10 mx-auto max-w-2xl">
          {gym.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gym.logo_url}
              alt={gym.name}
              className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <div
              className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl text-black"
              style={{ background: accent }}
            >
              💪
            </div>
          )}
          <div
            className="text-xs font-bold uppercase tracking-[3px]"
            style={{ color: accent }}
          >
            {gym.name}
          </div>
          <h1 className="mx-auto mb-3 mt-3 max-w-xl text-4xl font-bold leading-tight tracking-tight">
            {gym.tagline || "Entrená distinto. Resultados de verdad."}
          </h1>
          <p className="mx-auto mb-6 max-w-md text-ink-2">{gym.description}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="/acceso" className="btn btn-primary">
              Acceso miembros
            </a>
            {gym.whatsapp && (
              <a
                href={`https://wa.me/${gym.whatsapp.replace(/\D/g, "")}`}
                className="btn btn-ghost"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      {gym.benefits?.length > 0 && (
        <section className="px-6 py-12">
          <h2 className="mb-6 text-center text-2xl font-semibold">
            ¿Por qué elegirnos?
          </h2>
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
            {gym.benefits.map((b, i) => (
              <div key={i} className="card text-center">
                <div
                  className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl text-black"
                  style={{ background: accent }}
                >
                  ✓
                </div>
                <b>{b}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PLANES */}
      {plans.length > 0 && (
        <section className="px-6 pb-12">
          <h2 className="mb-6 text-center text-2xl font-semibold">
            Planes de socio
          </h2>
          <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-3">
            {plans.map((p, i) => (
              <div
                key={i}
                className="card text-center"
                style={
                  i === 1 && plans.length === 3
                    ? { borderColor: accent }
                    : undefined
                }
              >
                <b className="text-base">{p.name}</b>
                <div className="my-2 text-3xl font-extrabold tracking-tight">
                  ${p.price}
                  <span className="text-xs text-muted">/mes</span>
                </div>
                <span className="text-sm text-ink-2">{p.detail}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-surface px-6 py-5 text-sm text-ink-2">
        <div>
          {gym.address && <>📍 {gym.address} · </>}
          {gym.whatsapp && <>📱 {gym.whatsapp}</>}
        </div>
        <div className="text-xs text-muted">
          Powered by <b style={{ color: accent }}>GymCore</b>
        </div>
      </footer>
    </main>
  );
}
