import type { Gym, LandingSectionKey, MemberPlan } from "@/types/db";

/**
 * Plantilla "Clásica": hero centrado con imagen de fondo a página completa,
 * secciones apiladas con tarjetas suaves. Es el diseño original de GymCore.
 */
export default function ClasicaLanding({
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
  const testimonials = gym.testimonials || [];
  const schedule = gym.class_schedule || [];
  const joinHref = `/portal/registro?gym=${gym.slug}`;
  const loginHref = `/g/${gym.slug}`;
  const waHref = gym.whatsapp ? `https://wa.me/${gym.whatsapp.replace(/\D/g, "")}` : null;
  const mapsHref = gym.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gym.address)}`
    : null;
  const mapEmbed = gym.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(gym.address)}&output=embed`
    : null;
  const igHref = gym.instagram
    ? gym.instagram.startsWith("http")
      ? gym.instagram
      : `https://instagram.com/${gym.instagram.replace(/^@/, "").trim()}`
    : null;

  const Logo = () =>
    gym.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={gym.logo_url} alt={gym.name} className="h-10 w-10 rounded-xl object-cover" />
    ) : (
      <div className="grid h-10 w-10 place-items-center rounded-xl text-lg text-black" style={{ background: accent }}>
        💪
      </div>
    );

  function renderSection(key: LandingSectionKey) {
    switch (key) {
      case "beneficios":
        return (
          <section key={key} className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-center text-3xl font-bold tracking-tight">¿Por qué elegirnos?</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-surface p-6 transition hover:border-white/20">
                  <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl text-black" style={{ background: accent }}>
                    ✓
                  </div>
                  <p className="font-semibold">{b}</p>
                </div>
              ))}
            </div>
          </section>
        );
      case "galeria":
        return (
          <section key={key} className="mx-auto max-w-6xl px-6 py-12">
            <h2 className="mb-6 text-center text-3xl font-bold tracking-tight">Conocé el lugar</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((url, i) => (
                <div
                  key={i}
                  className={`overflow-hidden rounded-2xl border border-white/10 ${
                    i === 0 && gallery.length > 2 ? "sm:col-span-2 lg:col-span-2 lg:row-span-2" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full min-h-[180px] w-full object-cover transition hover:scale-105" />
                </div>
              ))}
            </div>
          </section>
        );
      case "planes":
        return (
          <section key={key} className="mx-auto max-w-5xl px-6 py-16">
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
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-black"
                        style={{ background: accent }}
                      >
                        Más elegido
                      </span>
                    )}
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
                );
              })}
            </div>
          </section>
        );
      case "horarios":
        return (
          <section key={key} className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-center text-3xl font-bold tracking-tight">Horarios y clases</h2>
            <p className="mt-2 text-center text-ink-2">Organizá tu semana y no te pierdas ninguna.</p>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-surface">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-white/5 text-ink-2">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Día</th>
                    <th className="px-4 py-3 font-semibold">Horario</th>
                    <th className="px-4 py-3 font-semibold">Clase</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((s, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="px-4 py-3 font-medium">{s.day}</td>
                      <td className="px-4 py-3 text-ink-2">{s.time}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `${accent}22`, color: accent }}>
                          {s.name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      case "testimonios":
        return (
          <section key={key} className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-center text-3xl font-bold tracking-tight">Lo que dicen nuestros socios</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <figure key={i} className="flex flex-col rounded-2xl border border-white/10 bg-surface p-6">
                  <div className="text-3xl leading-none" style={{ color: accent }}>“</div>
                  <blockquote className="mt-2 flex-1 text-sm text-ink-2">{t.text}</blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full text-sm font-black text-black" style={{ background: accent }}>
                      {(t.name || "S").slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold">{t.name}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      case "contacto":
        return (
          <section key={key} className="mx-auto max-w-5xl px-6 py-16">
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-surface p-8 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Vení a conocernos</h2>
                <p className="mt-2 text-ink-2">Te esperamos para una clase de prueba. Escribinos o pasá cuando quieras.</p>
                <div className="mt-4 space-y-1 text-sm text-ink-2">
                  {gym.address && <div>📍 {gym.address}</div>}
                  {gym.open_hours && <div>🕒 {gym.open_hours}</div>}
                  {gym.whatsapp && <div>📱 {gym.whatsapp}</div>}
                  {igHref && (
                    <div>
                      📷{" "}
                      <a href={igHref} target="_blank" rel="noreferrer" className="underline hover:text-ink">
                        {gym.instagram}
                      </a>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
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
            </div>
            {mapEmbed && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <iframe
                  src={mapEmbed}
                  title="Ubicación"
                  className="h-72 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </section>
        );
      default:
        return null;
    }
  }

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
              <a href={igHref} target="_blank" rel="noreferrer" className="hidden text-sm text-ink-2 hover:text-ink sm:inline" title="Instagram">
                📷 Instagram
              </a>
            )}
            <a href={loginHref} className="hidden text-sm text-ink-2 hover:text-ink sm:inline">
              Ingresar
            </a>
            <a href={joinHref} className="btn btn-primary text-sm">
              Sumate
            </a>
          </div>
        </div>
      </header>

      {/* HERO / BANNER */}
      <section className="relative min-h-[560px] overflow-hidden sm:min-h-[640px]">
        {gym.hero_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gym.hero_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        )}
        {/* velo de color: el banner se tiñe con el color del gimnasio y el texto queda adelante */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(115deg, ${accent}22 0%, rgba(10,13,18,.72) 45%, rgba(10,13,18,.95) 100%)` }}
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(10,13,18,.35), rgba(10,13,18,.9))` }} />
        <div
          className="pointer-events-none absolute left-1/2 top-[-30%] h-[600px] w-[600px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${accent}44, transparent 60%)` }}
        />
        <div className="relative z-10 mx-auto flex min-h-[560px] max-w-3xl flex-col items-center justify-center px-6 py-24 text-center sm:min-h-[640px] sm:py-32">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[2px] backdrop-blur"
            style={{ color: accent }}
          >
            <span className="grid h-2 w-2 place-items-center rounded-full" style={{ background: accent }} />
            {gym.name}
          </div>
          <h1 className="mx-auto max-w-2xl text-4xl font-black leading-[1.03] tracking-tight sm:text-6xl">
            {gym.tagline || "Entrená distinto. Resultados de verdad."}
          </h1>
          {gym.description && <p className="mx-auto mt-5 max-w-xl text-lg text-ink-2">{gym.description}</p>}
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href={joinHref} className="btn btn-primary px-6 py-3 text-base">
              Sumate ahora
            </a>
            <a
              href={loginHref}
              className="btn btn-ghost border-white/20 px-6 py-3 text-base backdrop-blur"
            >
              Acceso miembros
            </a>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-ghost px-6 py-3 text-base">
                💬 Escribinos
              </a>
            )}
          </div>
          <p className="mt-5 text-xs text-muted">
            ¿Ya sos socio?{" "}
            <a href={loginHref} className="underline hover:text-ink">
              Ingresá a tu portal
            </a>
          </p>
        </div>
      </section>

      {/* SECCIONES OPCIONALES, en el orden elegido por el dueño */}
      {sections.map(renderSection)}

      {/* CTA FINAL */}
      <section className="px-6 pb-20">
        <div
          className="mx-auto max-w-4xl rounded-3xl border border-white/10 px-6 py-14 text-center"
          style={{ background: `radial-gradient(120% 120% at 50% 0%, ${accent}22, transparent 60%)` }}
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Empezá tu cambio hoy</h2>
          <p className="mx-auto mt-3 max-w-md text-ink-2">
            Creá tu cuenta de socio en un minuto y accedé a tu rutina, tus clases y tu membresía.
          </p>
          <a href={joinHref} className="btn btn-primary mt-6 px-7 py-3 text-base">
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
