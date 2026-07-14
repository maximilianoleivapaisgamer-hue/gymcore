import type { Gym, LandingSectionKey, MemberPlan } from "@/types/db";

/**
 * Plantilla "Moderna": hero partido en dos columnas, tarjetas numeradas,
 * galería tipo filmstrip horizontal y bloques con fondo de color. Look más
 * editorial que la plantilla Clásica, pensado para gimnasios boutique.
 */
export default function ModernaLanding({
  gym,
  plans,
  sections,
}: {
  gym: Gym;
  plans: MemberPlan[];
  sections: LandingSectionKey[];
}) {
  const accent = gym.accent_color || "#22d3ee";
  const benefits = gym.benefits || [];
  const gallery = gym.gallery || [];
  const joinHref = `/portal/registro?gym=${gym.slug}`;
  const loginHref = `/g/${gym.slug}`;
  const waHref = gym.whatsapp ? `https://wa.me/${gym.whatsapp.replace(/\D/g, "")}` : null;
  const mapsHref = gym.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gym.address)}`
    : null;
  const igHref = gym.instagram
    ? gym.instagram.startsWith("http")
      ? gym.instagram
      : `https://instagram.com/${gym.instagram.replace(/^@/, "").trim()}`
    : null;

  const Logo = () =>
    gym.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={gym.logo_url} alt={gym.name} className="h-10 w-10 rounded-full bg-white/5 object-contain p-0.5" />
    ) : (
      <div className="grid h-10 w-10 place-items-center rounded-full text-lg text-black" style={{ background: accent }}>
        💪
      </div>
    );

  function renderSection(key: LandingSectionKey) {
    switch (key) {
      case "beneficios":
        return (
          <section key={key} className="mx-auto max-w-6xl px-6 py-16">
            <div className="mb-8 flex items-end justify-between gap-4">
              <h2 className="text-3xl font-bold tracking-tight">Por qué entrenar acá</h2>
              <div className="hidden h-px flex-1 bg-white/10 sm:block" />
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b, i) => (
                <div key={i} className="bg-bg p-6">
                  <div className="mb-3 text-3xl font-black" style={{ color: accent }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <p className="font-semibold leading-snug">{b}</p>
                </div>
              ))}
            </div>
          </section>
        );
      case "galeria":
        return (
          <section key={key} className="py-12">
            <h2 className="mx-auto mb-6 max-w-6xl px-6 text-3xl font-bold tracking-tight">Un vistazo por dentro</h2>
            <div className="flex gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:thin]">
              {gallery.map((url, i) => (
                <div
                  key={i}
                  className="h-64 w-56 shrink-0 overflow-hidden rounded-2xl border-2"
                  style={{ borderColor: `${accent}55` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover transition hover:scale-105" />
                </div>
              ))}
            </div>
          </section>
        );
      case "planes":
        return (
          <section key={key} className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-3xl font-bold tracking-tight">Membresías</h2>
            <p className="mt-2 text-ink-2">Elegí el plan que mejor se adapta a tu ritmo.</p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {plans.map((p, i) => {
                const featured = plans.length === 3 ? i === 1 : i === 0;
                return (
                  <div key={i} className="relative overflow-hidden rounded-2xl bg-surface">
                    {featured && (
                      <span
                        className="absolute left-0 top-0 rounded-br-xl px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-black"
                        style={{ background: accent }}
                      >
                        Recomendado
                      </span>
                    )}
                    <div className="h-1.5 w-full" style={{ background: featured ? accent : "rgba(255,255,255,.12)" }} />
                    <div className="flex flex-col p-6 pt-8">
                      <b className="text-lg">{p.name}</b>
                      <div className="my-3 text-4xl font-black tracking-tight">
                        ${p.price}
                        <span className="text-sm font-normal text-muted">/mes</span>
                      </div>
                      {p.detail && <p className="mb-5 flex-1 text-sm text-ink-2">{p.detail}</p>}
                      <a href={joinHref} className={`btn text-sm ${featured ? "btn-primary" : "btn-ghost"}`}>
                        Elegir {p.name}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      case "contacto":
        return (
          <section key={key} className="px-6 py-16">
            <div
              className="mx-auto grid max-w-6xl gap-6 rounded-3xl p-8 md:grid-cols-2 md:items-center"
              style={{ background: `linear-gradient(135deg, ${accent}1a, rgba(255,255,255,.03))` }}
            >
              <div className="order-2 flex flex-wrap gap-3 md:order-1">
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    Cómo llegar
                  </a>
                )}
                {igHref && (
                  <a href={igHref} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    📷 Instagram
                  </a>
                )}
                {waHref && (
                  <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-primary">
                    💬 WhatsApp
                  </a>
                )}
              </div>
              <div className="order-1 text-right md:order-2">
                <h2 className="text-2xl font-bold tracking-tight">¿Nos conocemos?</h2>
                <p className="mt-2 text-ink-2">Pasá por el gym o escribinos, te esperamos.</p>
                <div className="mt-4 space-y-1 text-sm text-ink-2">
                  {gym.address && <div>{gym.address} 📍</div>}
                  {gym.whatsapp && <div>{gym.whatsapp} 📱</div>}
                </div>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  }

  return (
    <main style={{ "--accent": accent } as React.CSSProperties} className="bg-bg text-ink">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-bg">
        <div className="h-1 w-full" style={{ background: accent }} />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="font-bold">{gym.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={loginHref} className="hidden text-sm text-ink-2 hover:text-ink sm:inline">
              Ingresar
            </a>
            <a href={joinHref} className="btn btn-primary text-sm">
              Sumate ahora
            </a>
          </div>
        </div>
      </header>

      {/* HERO EN DOS COLUMNAS */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[2px]"
            style={{ color: accent, borderColor: `${accent}55` }}
          >
            {gym.name}
          </div>
          <h1 className="max-w-xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            {gym.tagline || "Entrená distinto. Resultados de verdad."}
          </h1>
          {gym.description && <p className="mt-5 max-w-md text-lg text-ink-2">{gym.description}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={joinHref} className="btn btn-primary px-6 py-3 text-base">
              Sumate ahora
            </a>
            <a href={loginHref} className="btn btn-ghost border-white/20 px-6 py-3 text-base">
              Acceso miembros
            </a>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-ghost px-6 py-3 text-base">
                💬 Escribinos
              </a>
            )}
          </div>
          <p className="mt-4 text-xs text-muted">
            ¿Ya sos socio?{" "}
            <a href={loginHref} className="underline hover:text-ink">
              Ingresá a tu portal
            </a>
          </p>
        </div>
        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-4 rounded-[2rem] blur-2xl"
            style={{ background: `radial-gradient(circle, ${accent}30, transparent 65%)` }}
          />
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border-2" style={{ borderColor: `${accent}55` }}>
            {gym.hero_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gym.hero_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className="grid h-full w-full place-items-center text-6xl"
                style={{ background: `linear-gradient(135deg, ${accent}55, rgba(255,255,255,.05))` }}
              >
                💪
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECCIONES OPCIONALES, en el orden elegido por el dueño */}
      {sections.map(renderSection)}

      {/* CTA FINAL — bloque de color sólido */}
      <section className="px-6 pb-20">
        <div
          className="mx-auto flex max-w-6xl flex-col items-center gap-5 rounded-3xl px-6 py-14 text-center sm:flex-row sm:justify-between sm:text-left"
          style={{ background: accent }}
        >
          <div>
            <h2 className="text-3xl font-black tracking-tight text-black sm:text-4xl">Empezá tu cambio hoy</h2>
            <p className="mt-2 max-w-md text-black/70">Creá tu cuenta de socio en un minuto y arrancá a entrenar.</p>
          </div>
          <a href={joinHref} className="shrink-0 rounded-xl bg-black px-7 py-3 text-base font-bold text-white transition hover:opacity-90">
            Sumate a {gym.name}
          </a>
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
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted">
          <span>
            {gym.name} · Powered by <b style={{ color: accent }}>GymCore</b>
          </span>
          {igHref && (
            <a href={igHref} target="_blank" rel="noreferrer" className="hover:text-ink-2">
              Instagram ↗
            </a>
          )}
        </div>
      </footer>
    </main>
  );
}
