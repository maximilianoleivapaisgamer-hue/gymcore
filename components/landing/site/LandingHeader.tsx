"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

interface NavLink { href: string; label: string; }

/**
 * Header sticky de la landing con menú mobile. El logo es el del gimnasio (o su
 * nombre). El botón "Ingresar" va al portal del socio.
 */
export function LandingHeader({
  nombre,
  logoUrl,
  portalUrl,
  links,
}: {
  nombre: string;
  logoUrl: string | null;
  portalUrl: string;
  links: NavLink[];
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const Logo = () =>
    logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={nombre} className="h-9 w-9 rounded-lg object-contain" />
    ) : (
      <span className="grid h-9 w-9 place-items-center rounded-lg text-lg" style={{ background: "var(--l-brand)", color: "var(--l-brand-fg)" }}>
        <Icon name="Dumbbell" className="size-5" />
      </span>
    );

  return (
    <header
      className="sticky top-0 z-40 border-b transition-colors"
      style={{
        borderColor: scrolled || open ? "var(--l-border)" : "transparent",
        backgroundColor: scrolled || open ? "color-mix(in srgb, var(--l-bg) 85%, transparent)" : "transparent",
        backdropFilter: scrolled || open ? "blur(8px)" : "none",
      }}
    >
      <nav className="tg-container flex h-16 items-center justify-between gap-4">
        <a href="#top" aria-label={`${nombre} — inicio`} className="flex shrink-0 items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-bold">{nombre}</span>
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="tg-muted rounded-md px-3 py-2 text-sm font-medium transition-colors hover:opacity-80">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a href={portalUrl} className="tg-btn tg-btn-primary tg-btn-sm hidden sm:inline-flex">
            <Icon name="LogIn" className="size-4" /> Ingresar
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            className="grid size-10 place-items-center rounded-md lg:hidden"
          >
            <Icon name={open ? "X" : "Menu"} className="size-6" />
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t lg:hidden" style={{ borderColor: "var(--l-border)", backgroundColor: "var(--l-bg)" }}>
          <ul className="tg-container flex flex-col gap-1 py-4">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-base font-medium hover:opacity-80">
                  {l.label}
                </a>
              </li>
            ))}
            <li className="mt-2">
              <a href={portalUrl} onClick={() => setOpen(false)} className="tg-btn tg-btn-primary tg-btn-block">
                <Icon name="LogIn" className="size-4" /> Ingresar / Reservar
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
