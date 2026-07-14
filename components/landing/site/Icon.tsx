import type { CSSProperties } from "react";

/**
 * Íconos inline (sin lucide-react) para la landing pública. Estilo line-icon
 * 24×24. Los beneficios eligen su ícono por nombre (PascalCase). Si el nombre
 * no existe, cae en "Dumbbell".
 */

const PATHS: Record<string, JSX.Element> = {
  Dumbbell: <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" />,
  CalendarClock: (
    <>
      <rect x="3" y="4.5" width="13" height="13" rx="2" />
      <path d="M3 9h13M7.5 2.5v4M12 2.5v4" />
      <circle cx="17.5" cy="16.5" r="4.5" />
      <path d="M17.5 14.7v1.8l1.3 1" />
    </>
  ),
  Users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0111 0M16 5.5a3 3 0 010 5.8M18.5 20a5.2 5.2 0 00-3-4.7" />
    </>
  ),
  Sparkles: (
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  ),
  Clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  ShieldCheck: (
    <>
      <path d="M12 2.5l8 3.5v5c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-5z" />
      <path d="M8.8 12l2.2 2.2 4.2-4.4" />
    </>
  ),
  Heart: <path d="M12 21s-7-4.5-9.5-9A5.2 5.2 0 0112 5a5.2 5.2 0 019.5 7c-2.5 4.5-9.5 9-9.5 9z" />,
  Flame: <path d="M12 3c1.5 3 4.5 4.2 4.5 8.5a4.5 4.5 0 01-9 0c0-2 .8-3.2 1.8-4.3.6 2.2 2.2 2.3 2.2 4.3" />,
  Trophy: (
    <>
      <path d="M7 4h10v4a5 5 0 01-10 0z" />
      <path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M9 20h6M10 20v-3.5M14 20v-3.5" />
    </>
  ),
  Music: (
    <>
      <path d="M9 18V6l11-2v12" />
      <circle cx="6" cy="18" r="2.6" />
      <circle cx="17" cy="16" r="2.6" />
    </>
  ),
  Wifi: <path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01" />,
  MapPin: (
    <>
      <path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  Star: <path d="M12 3l2.9 6 6.1.9-4.5 4.3 1.1 6.1L12 17.8 6.4 20.3l1.1-6.1L3 9.9 9.1 9z" />,
  Zap: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  Target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
  Droplet: <path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" />,

  // UI
  LogIn: <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />,
  MessageCircle: <path d="M21 11.5a8.5 8.5 0 01-12.6 7.5L3 21l2-5.4A8.5 8.5 0 1121 11.5z" />,
  Check: <path d="M20 6L9 17l-5-5" />,
  Navigation: <path d="M3 11l19-8-8 19-2.5-8.5L3 11z" />,
  Menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  X: <path d="M6 6l12 12M18 6L6 18" />,
  Mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5L12 12l8.5-5.5" />
    </>
  ),
  Phone: <path d="M6.5 2.5c.4 3 1.6 5.2 3.5 7s4 3.1 7 3.5l-1.5 3.5c-4-.4-7.6-2.7-10.2-5.3S3.4 8.5 3 4.5z" />,
};

export function Icon({ name, className = "size-6", style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name] || PATHS.Dumbbell}
    </svg>
  );
}

/** Lista de íconos disponibles para el selector de beneficios (editor). */
export const BENEFIT_ICONS = [
  "Dumbbell", "CalendarClock", "Users", "Sparkles", "Clock", "ShieldCheck",
  "Heart", "Flame", "Trophy", "Music", "Wifi", "MapPin", "Star", "Zap", "Target", "Droplet",
] as const;

// Íconos de marca (rellenos) para redes sociales.
export function InstagramIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.22 1 .48 1.4.9.42.4.68.8.9 1.4.17.4.36 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2-.22.6-.48 1-.9 1.4-.4.42-.8.68-1.4.9-.4.17-1 .36-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42-.6-.22-1-.48-1.4-.9-.42-.4-.68-.8-.9-1.4-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.22-.6.48-1 .9-1.4.4-.42.8-.68 1.4-.9.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.07-1.1.05-1.7.24-2.1.4-.5.2-.9.44-1.3.84-.4.4-.64.8-.84 1.3-.16.4-.35 1-.4 2.1C2.6 9.5 2.6 9.9 2.6 12s0 2.5.06 3.7c.05 1.1.24 1.7.4 2.1.2.5.44.9.84 1.3.4.4.8.64 1.3.84.4.16 1 .35 2.1.4 1.2.06 1.6.07 4.7.07s3.5 0 4.7-.07c1.1-.05 1.7-.24 2.1-.4.5-.2.9-.44 1.3-.84.4-.4.64-.8.84-1.3.16-.4.35-1 .4-2.1.06-1.2.07-1.6.07-3.7s0-2.5-.07-3.7c-.05-1.1-.24-1.7-.4-2.1-.2-.5-.44-.9-.84-1.3-.4-.4-.8-.64-1.3-.84-.4-.16-1-.35-2.1-.4C15.5 4 15.1 4 12 4zm0 3.1a4.9 4.9 0 110 9.8 4.9 4.9 0 010-9.8zm0 8.1a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zm6.2-8.3a1.15 1.15 0 11-2.3 0 1.15 1.15 0 012.3 0z" />
    </svg>
  );
}
export function FacebookIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0022 12z" />
    </svg>
  );
}
export function TiktokIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 3c.3 2.1 1.5 3.6 3.5 3.9v2.4c-1.3.1-2.5-.3-3.5-.9v5.9c0 3.3-2.4 5.7-5.5 5.7A5.5 5.5 0 016 14.6c0-3.2 3-5.6 6.2-5.1v2.5c-.4-.1-.9-.2-1.3-.2-1.5 0-2.7 1.2-2.7 2.8 0 1.5 1.2 2.7 2.7 2.7 1.5 0 2.8-1.2 2.8-2.9V3h2.8z" />
    </svg>
  );
}
