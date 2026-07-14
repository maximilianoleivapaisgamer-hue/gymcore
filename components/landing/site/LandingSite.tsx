import { landingBrandStyle, landingLinks, type LandingConfig } from "@/lib/landing-config";
import { Icon, InstagramIcon, FacebookIcon, TiktokIcon, WhatsappIcon } from "./Icon";
import { Reveal } from "./Reveal";
import { LandingHeader } from "./LandingHeader";
import { Gallery } from "./Gallery";

const money = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const waLink = (num: string, msg?: string) =>
  num ? `https://wa.me/${num.replace(/\D/g, "")}${msg ? `?text=${encodeURIComponent(msg)}` : ""}` : null;
const mapsEmbed = (q: string) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
const mapsLink = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const igLink = (v: string) => (v.startsWith("http") ? v : `https://instagram.com/${v.replace(/^@/, "").trim()}`);

function SectionHeading({ eyebrow, titulo, descripcion }: { eyebrow: string; titulo: string; descripcion?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="tg-eyebrow">{eyebrow}</span>
      <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl">{titulo}</h2>
      {descripcion && <p className="tg-muted max-w-2xl text-base sm:text-lg">{descripcion}</p>}
    </div>
  );
}

/**
 * Landing pública definitiva. Server Component: recibe la config ya resuelta y
 * el slug, e inyecta las variables de marca en el root. Sobre Nosotros y
 * Testimonios no se renderizan (fuera por decisión de producto). Ubicación y el
 * CTA final van siempre.
 */
export default function LandingSite({ config, slug, preview = false }: { config: LandingConfig; slug: string; preview?: boolean }) {
  const { portalUrl, joinHref } = landingLinks(slug);
  const wa = waLink(config.whatsapp, "Hola, vengo desde la web. Quiero info del gimnasio.");
  const s = config.secciones;

  const showBeneficios = s.beneficios && config.beneficios.length > 0;
  const showClases = s.clases && config.clases.length > 0;
  const showPlanes = s.planes && config.planes.length > 0;
  const showGaleria = s.galeria && config.galeria.length > 0;

  const links = [
    showBeneficios && { href: "#beneficios", label: "Beneficios" },
    showClases && { href: "#clases", label: "Clases" },
    showPlanes && { href: "#planes", label: "Planes" },
    showGaleria && { href: "#galeria", label: "Galería" },
    { href: "#ubicacion", label: "Ubicación" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="tg-landing relative" style={landingBrandStyle(config.marca)}>
      <LandingHeader nombre={config.nombre} logoUrl={config.logoUrl} portalUrl={portalUrl} links={links} sticky={!preview} />

      <main>
        {/* HERO */}
        <section id="top" className="relative overflow-hidden">
          {config.heroImagen && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.heroImagen} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          )}
          <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--l-brand) 15%, transparent), color-mix(in srgb, var(--l-bg) 60%, transparent), var(--l-bg))" }} />
          <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full blur-3xl" style={{ background: "color-mix(in srgb, var(--l-brand) 25%, transparent)" }} />

          <div className="tg-container relative flex min-h-[88vh] flex-col items-center justify-center gap-7 py-24 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide tg-muted" style={{ borderColor: "var(--l-border)", backgroundColor: "color-mix(in srgb, var(--l-surface) 70%, transparent)" }}>
              <span className="size-2 rounded-full" style={{ background: "var(--l-brand)" }} /> Sumate a la comunidad
            </span>
            {config.heroLogo && config.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt={config.nombre} className="mb-2 h-24 w-auto max-w-[280px] object-contain sm:h-32" />
            )}
            <h1 className="max-w-4xl text-4xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl" style={config.tituloColor ? { color: config.tituloColor } : undefined}>{config.nombre}</h1>
            <p className="max-w-2xl text-lg font-medium sm:text-2xl" style={{ color: "color-mix(in srgb, var(--l-text) 90%, transparent)" }}>{config.tagline}</p>
            <p className="tg-muted max-w-xl text-base sm:text-lg">{config.descripcion}</p>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <a href={portalUrl} className="tg-btn tg-btn-primary tg-btn-lg">
                <Icon name="LogIn" className="size-5" /> Reservá tu clase
              </a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="tg-btn tg-btn-secondary tg-btn-lg">
                  <Icon name="MessageCircle" className="size-5" /> Escribinos
                </a>
              )}
            </div>

            <p className="tg-muted inline-flex items-center gap-2 text-sm">
              <Icon name="MapPin" className="size-4" style={{ color: "var(--l-brand)" }} />
              {config.ubicacion.direccion}, {config.ubicacion.ciudad}
            </p>
          </div>
        </section>

        {/* BENEFICIOS */}
        {showBeneficios && (
          <section id="beneficios" className="py-20 sm:py-28">
            <div className="tg-container flex flex-col gap-12">
              <SectionHeading eyebrow="Por qué elegirnos" titulo="Todo lo que necesitás para entrenar en serio" descripcion="Sin vueltas: buen equipamiento, buenas clases y gente que te acompaña." />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {config.beneficios.map((b, i) => (
                  <Reveal key={i} delay={i * 0.05}>
                    <article className="tg-card flex h-full flex-col gap-3 p-6">
                      <span className="grid size-12 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--l-brand) 10%, transparent)", color: "var(--l-brand)" }}>
                        <Icon name={b.icon} className="size-6" />
                      </span>
                      <h3 className="text-lg font-semibold">{b.titulo}</h3>
                      <p className="tg-muted text-sm">{b.texto}</p>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CLASES */}
        {showClases && (
          <section id="clases" className="tg-surface2 py-20 sm:py-28">
            <div className="tg-container flex flex-col gap-12">
              <SectionHeading eyebrow="Grilla semanal" titulo="Clases para todos los días" descripcion="Elegí la disciplina que va con vos. Reservá tu lugar desde el portal." />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {config.clases.map((c, i) => (
                  <Reveal key={i} delay={i * 0.04}>
                    <article className="tg-card flex h-full flex-col gap-3 p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold">{c.nombre}</h3>
                        {typeof c.cupo === "number" && (
                          <span className="tg-muted inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "var(--l-surface-2)" }}>
                            <Icon name="Users" className="size-3.5" /> {c.cupo}
                          </span>
                        )}
                      </div>
                      <dl className="mt-1 flex flex-col gap-1.5 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="tg-muted">Días</dt>
                          <dd className="text-right font-medium">{c.dias}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="tg-muted">Horarios</dt>
                          <dd className="text-right font-medium">{c.horario}</dd>
                        </div>
                      </dl>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* PLANES */}
        {showPlanes && (
          <section id="planes" className="py-20 sm:py-28">
            <div className="tg-container flex flex-col gap-12">
              <SectionHeading eyebrow="Planes y precios" titulo="Elegí el plan que se adapta a vos" descripcion="Sin permanencia ni letra chica. Cambiás o cancelás cuando quieras." />
              <div className="grid items-stretch gap-5 md:grid-cols-3">
                {config.planes.map((p, i) => (
                  <Reveal key={i} delay={i * 0.06} className="h-full">
                    <div className="tg-card flex h-full flex-col gap-6 p-6" style={p.destacado ? { borderColor: "var(--l-brand)", boxShadow: "0 0 0 1px var(--l-brand)" } : undefined}>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xl font-semibold">{p.nombre}</h3>
                        {p.destacado && (
                          <span className="tg-badge"><Icon name="Star" className="size-3.5" /> Recomendado</span>
                        )}
                      </div>
                      <div className="flex items-end gap-1">
                        <span className="text-4xl font-bold tracking-tight">{money(p.precio)}</span>
                        <span className="tg-muted pb-1 text-sm">/ {p.periodo}</span>
                      </div>
                      <ul className="flex flex-col gap-3">
                        {p.incluye.filter((x) => x && x.trim()).map((item, k) => (
                          <li key={k} className="flex items-start gap-2.5 text-sm">
                            <Icon name="Check" className="mt-0.5 size-4 shrink-0" style={{ color: "var(--l-brand)" }} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto pt-2">
                        <a href={joinHref} className={`tg-btn tg-btn-block ${p.destacado ? "tg-btn-primary" : "tg-btn-secondary"}`}>Empezar ahora</a>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* GALERÍA */}
        {showGaleria && (
          <section id="galeria" className="tg-surface2 py-20 sm:py-28">
            <div className="tg-container flex flex-col gap-12">
              <SectionHeading eyebrow="Nuestras instalaciones" titulo="Conocé el gimnasio por dentro" descripcion="Tocá cualquier foto para verla en grande." />
              <Gallery images={config.galeria} />
            </div>
          </section>
        )}

        {/* UBICACIÓN (siempre) */}
        <section id="ubicacion" className="py-20 sm:py-28">
          <div className="tg-container flex flex-col gap-12">
            <SectionHeading eyebrow="Dónde estamos" titulo="Vení a conocernos" descripcion="Estamos cerca tuyo. Pasá cuando quieras y hacé tu primera clase." />
            <div className="grid gap-6 lg:grid-cols-5">
              <Reveal className="lg:col-span-2">
                <div className="tg-card flex h-full flex-col gap-6 p-6">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--l-brand) 10%, transparent)", color: "var(--l-brand)" }}>
                      <Icon name="MapPin" className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold">Dirección</h3>
                      <p className="tg-muted text-sm">{config.ubicacion.direccion}<br />{config.ubicacion.ciudad}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--l-brand) 10%, transparent)", color: "var(--l-brand)" }}>
                      <Icon name="Clock" className="size-5" />
                    </span>
                    <div className="flex-1">
                      <h3 className="font-semibold">Horarios</h3>
                      <ul className="mt-1 flex flex-col gap-1.5 text-sm">
                        {config.ubicacion.horarios.map((h, i) => (
                          <li key={i} className="flex justify-between gap-4">
                            <span className="tg-muted">{h.dia}</span>
                            <span className="font-medium">{h.horas}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <a href={mapsLink(config.ubicacion.mapsQuery)} target="_blank" rel="noopener noreferrer" className="tg-btn tg-btn-secondary tg-btn-block">
                      <Icon name="Navigation" className="size-4" /> Cómo llegar
                    </a>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.1} className="lg:col-span-3">
                <div className="h-full min-h-[320px] overflow-hidden rounded-[16px] border" style={{ borderColor: "var(--l-border)" }}>
                  <iframe
                    title={`Ubicación de ${config.nombre}`}
                    src={mapsEmbed(config.ubicacion.mapsQuery)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-full min-h-[320px] w-full"
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* CTA FINAL (siempre) */}
        <section id="contacto" className="py-20 sm:py-28">
          <div className="tg-container">
            <div className="relative overflow-hidden rounded-[24px] border px-6 py-14 text-center sm:px-12 sm:py-20" style={{ background: "var(--l-brand)", borderColor: "var(--l-border)" }}>
              <div aria-hidden className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
              <div aria-hidden className="absolute -bottom-20 -left-10 size-64 rounded-full bg-black/10 blur-2xl" />
              <div className="relative flex flex-col items-center gap-6">
                <h2 className="max-w-2xl text-3xl font-bold sm:text-4xl" style={{ color: "var(--l-brand-fg)" }}>Empezá a entrenar en {config.nombre} esta semana</h2>
                <p className="max-w-xl" style={{ color: "color-mix(in srgb, var(--l-brand-fg) 85%, transparent)" }}>Reservá tu lugar o escribinos por WhatsApp. Tu primera clase de prueba es gratis.</p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a href={portalUrl} className="tg-btn tg-btn-lg" style={{ background: "var(--l-brand-fg)", color: "var(--l-brand)" }}>
                    <Icon name="LogIn" className="size-5" /> Reservar ahora
                  </a>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="tg-btn tg-btn-lg" style={{ background: "transparent", color: "var(--l-brand-fg)", borderColor: "color-mix(in srgb, var(--l-brand-fg) 30%, transparent)" }}>
                      <Icon name="MessageCircle" className="size-5" /> Escribinos por WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t" style={{ borderColor: "var(--l-border)", backgroundColor: "var(--l-surface)" }}>
        <div className="tg-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              {config.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.logoUrl} alt={config.nombre} className="h-9 w-9 rounded-lg object-contain" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--l-brand)", color: "var(--l-brand-fg)" }}><Icon name="Dumbbell" className="size-5" /></span>
              )}
              <span className="text-[17px] font-bold">{config.nombre}</span>
            </div>
            <p className="tg-muted max-w-xs text-sm">{config.descripcion}</p>
            <div className="flex gap-3">
              {wa && <a href={wa} aria-label="WhatsApp" target="_blank" rel="noopener noreferrer" className="tg-muted transition-colors hover:opacity-80"><WhatsappIcon className="size-5" /></a>}
              {config.instagram && <a href={igLink(config.instagram)} aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="tg-muted transition-colors hover:opacity-80"><InstagramIcon className="size-5" /></a>}
              {config.facebook && <a href={config.facebook} aria-label="Facebook" target="_blank" rel="noopener noreferrer" className="tg-muted transition-colors hover:opacity-80"><FacebookIcon className="size-5" /></a>}
              {config.tiktok && <a href={config.tiktok} aria-label="TikTok" target="_blank" rel="noopener noreferrer" className="tg-muted transition-colors hover:opacity-80"><TiktokIcon className="size-5" /></a>}
            </div>
          </div>

          {links.length > 0 && (
            <nav className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Navegación</h3>
              <ul className="flex flex-col gap-2">
                {links.map((l) => (
                  <li key={l.href}><a href={l.href} className="tg-muted text-sm transition-colors hover:opacity-80">{l.label}</a></li>
                ))}
              </ul>
            </nav>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Contacto</h3>
            <ul className="tg-muted flex flex-col gap-2 text-sm">
              {wa && <li><a href={wa} className="inline-flex items-center gap-2 transition-colors hover:opacity-80" target="_blank" rel="noopener noreferrer"><Icon name="Phone" className="size-4" /> WhatsApp</a></li>}
              {config.email && <li><a href={`mailto:${config.email}`} className="inline-flex items-center gap-2 transition-colors hover:opacity-80"><Icon name="Mail" className="size-4" /> {config.email}</a></li>}
              <li className="inline-flex items-center gap-2"><Icon name="MapPin" className="size-4" /> {config.ubicacion.direccion}, {config.ubicacion.ciudad}</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Horarios</h3>
            <ul className="tg-muted flex flex-col gap-2 text-sm">
              {config.ubicacion.horarios.map((h, i) => (
                <li key={i} className="flex justify-between gap-4"><span>{h.dia}</span><span className="font-medium" style={{ color: "var(--l-text)" }}>{h.horas}</span></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t" style={{ borderColor: "var(--l-border)" }}>
          <div className="tg-container flex flex-col items-center justify-between gap-2 py-6 text-xs tg-muted sm:flex-row">
            <p>© 2026 {config.nombre}. Todos los derechos reservados.</p>
            <p>Hecho con <a href="https://turnogym.app" target="_blank" rel="noopener noreferrer" className="font-medium transition-colors hover:opacity-80" style={{ color: "var(--l-text)" }}>turnogym</a></p>
          </div>
        </div>
      </footer>

      {/* WhatsApp flotante (siempre a la derecha; en preview es absoluto) */}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Escribinos por WhatsApp" className={`${preview ? "absolute" : "fixed"} bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg transition hover:scale-105`} style={{ background: "#25D366", boxShadow: "0 8px 24px rgba(37,211,102,.45)" }}>
          <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
            <path d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.5A11.9 11.9 0 0016 27c6.6 0 12-5.4 12-12S22.6 3 16 3zm5.4 16.5c-.2.6-1.3 1.2-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.6-.6-2.9-1.3-4.8-4.3-5-4.5-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5.2.6.8 2 .9 2.1.1.1.1.3 0 .5-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.1.3.7 1.2 1.6 2 1.1.9 2 1.2 2.3 1.4.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.3.1 1.7.8 2 .9.3.2.5.2.6.3.1.2.1.7-.1 1.3z" />
          </svg>
        </a>
      )}
    </div>
  );
}
