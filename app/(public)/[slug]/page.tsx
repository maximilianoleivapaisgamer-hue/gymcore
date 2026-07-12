import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Gym, MemberPlan } from "@/types/db";

/**
 * Landing pública white-label del gimnasio: gymcore.app/<slug>
 * Server Component: lee el gimnasio por slug (lectura pública por RLS) y arma
 * una página premium con el branding cargado por el dueño. Conecta con el
 * funnel de socios (registro con el código del gym prefijado).
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
  const benefits = gym.benefits || [];
  const gallery = gym.gallery || [];
  const joinHref = `/portal/registro?gym=${gym.slug}`;
  const waHref = gym.whatsapp ? `https://wa.me/${gym.whatsapp.replace(/\D/g, "")}` : null;
  const mapsHref = gym.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gym.address)}` : null;
  const igHref = gym.instagram
    ? (gym.instagram.startsWith("http")
        ? gym.instagram
        : `https://instagram.com/${gym.instagram.replace(/^@/, "").trim()}`)
    : null;

  const Logo = () =>
    gym.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={gym.logo_url} alt={gym.name} className="h-10 w-10 rounded-xl object-cover" />
    ) : (
      <div className="grid h-10 w-10 place-items-center rounded-xl text-lg text-black" style={{ background: accent }}>💪</div>
    );

  return (
    <main style={{ "--accent": accent } as React.CSSProperties} className="bg-bg text-ink">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="font-bold">{gym.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {igHref && (
              <a href={igHref} target="_blank" rel="noreferrer" className="hidden text-sm text-ink-2 hover:text-ink sm:inline" title="Instagram">📷 Instagram</a>
            )}
            <a href="/acceso" className="hidden text-sm text-ink-2 hover:text-ink sm:inline">Ingresar</a>
            <a href={joinHref} className="btn btn-primary text-sm">Sumate</a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        {gym.hero_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gym.hero_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(10,13,18,.55), rgba(10,13,18,.92))` }} />
        <div
          className="pointer-events-none absolute left-1/2 top-[-30%] h-[600px] w-[600px] -translate-x-1/2 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${accent}33, transparent 60%)` }}
        />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[2px]" style={{ color: accent }}>
            {gym.name}
          </div>
          <h1 className="mx-auto max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            {gym.tagline || "Entrená distinto. Resultados de verdad."}
          </h1>
          {gym.description && <p className="mx-auto mt-5 max-w-xl text-lg text-ink-2">{gym.description}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={joinHref} className="btn btn-primary px-6 py-3 text-base">Sumate ahora</a>
            {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-ghost px-6 py-3 text-base">💬 Escribinos</a>}
          </div>
          <p className="mt-4 text-xs text-muted">¿Ya sos socio? <a href="/acceso" className="underline hover:text-ink">Ingresá a tu portal</a></p>
        </div>
      </section>

      {/* BENEFICIOS */}
      {benefits.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">¿Por qué elegirnos?</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-surface p-6 transition hover:border-white/20">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl text-black" style={{ background: accent }}>✓</div>
                <p className="font-semibold">{b}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* GALERÍA / BANNERS */}
      {gallery.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="mb-6 text-center text-3xl font-bold tracking-tight">Conocé el lugar</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((url, i) => (
              <div
                key={i}
                className={`overflow-hidden rounded-2xl border border-white/10 ${i === 0 && gallery.length > 2 ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full min-h-[180px] w-full object-cover transition hover:scale-105" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* PLANES */}
      {plans.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight">Elegí tu plan</h2>
          <p className="mt-2 text-center text-ink-2">Sumate hoy y arrancá a entrenar.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {plans.map((p, i) => {
              const featured = plans.length === 3 ? i === 1 : i === 0;
              return (
                <div
                  key={i}
                  className="relative flex flex-col rounded-2xl border bg-surface p-6"
                  style={{ borderColor: featured ? accent : "rgba(255,255,255,.1)" }}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-black" style={{ background: accent }}>
                      Más elegido
                    </span>
                  )}
                  <b className="text-lg">{p.name}</b>
                  <div className="my-3 text-4xl font-black tracking-tight">
                    ${p.price}
                    <span className="text-sm font-normal text-muted">/mes</span>
                  </div>
                  {p.detail && <p className="mb-5 flex-1 text-sm text-ink-2">{p.detail}</p>}
                  <a
                    href={joinHref}
                    className={`btn text-sm ${featured ? "btn-primary" : "btn-ghost"}`}
                  >
                    Elegir {p.name}
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* UBICACIÓN / CONTACTO */}
      {(gym.address || gym.whatsapp) && (
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-4 rounded-2xl border border-white/10 bg-surface p-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Vení a conocernos</h2>
              <p className="mt-2 text-ink-2">Te esperamos para una clase de prueba. Escribinos o pasá cuando quieras.</p>
              <div className="mt-4 space-y-1 text-sm text-ink-2">
                {gym.address && <div>📍 {gym.address}</div>}
                {gym.whatsapp && <div>📱 {gym.whatsapp}</div>}
                {igHref && <div>📷 <a href={igHref} target="_blank" rel="noreferrer" className="underline hover:text-ink">{gym.instagram}</a></div>}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              {mapsHref && <a href={mapsHref} target="_blank" rel="noreferrer" className="btn btn-ghost">Cómo llegar</a>}
              {igHref && <a href={igHref} target="_blank" rel="noreferrer" className="btn btn-ghost">📷 Instagram</a>}
              {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-primary">💬 WhatsApp</a>}
            </div>
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="px-6 pb-20">
        <div
          className="mx-auto max-w-4xl rounded-3xl border border-white/10 px-6 py-14 text-center"
          style={{ background: `radial-gradient(120% 120% at 50% 0%, ${accent}22, transparent 60%)` }}
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Empezá tu cambio hoy</h2>
          <p className="mx-auto mt-3 max-w-md text-ink-2">Creá tu cuenta de socio en un minuto y accedé a tu rutina, tus clases y tu membresía.</p>
          <a href={joinHref} className="btn btn-primary mt-6 px-7 py-3 text-base">Sumate a {gym.name}</a>
        </div>
      </section>

      {/* WHATSAPP FLOTANTE */}
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          aria-label="Escribinos por WhatsApp"
          className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full text-2xl shadow-lg transition hover:scale-105"
          style={{ background: "#25D366", boxShadow: "0 8px 24px rgba(37,211,102,.45)" }}
        >
          <span aria-hidden>💬</span>
        </a>
      )}

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-ink-2">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-semibold text-ink">{gym.name}</span>
          </div>
          <div className="text-xs text-muted">
            Powered by <b style={{ color: accent }}>GymCore</b>
          </div>
        </div>
      </footer>
    </main>
  );
}
