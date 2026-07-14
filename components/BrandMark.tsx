/**
 * Logo de la plataforma turnogym.
 * - <BrandMark/>: el ícono cuadrado (T-mancuerna) en degradé cian→azul.
 * - <BrandWordmark/>: el logotipo "turnogym" (turno neutro + gym en cian).
 * - <BrandLockup/>: ícono + wordmark, uno al lado del otro.
 */

export function BrandMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id="brandmark-tg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#brandmark-tg)" />
      <g fill="#04121A">
        <rect x="150" y="188" width="212" height="34" rx="17" />
        <circle cx="150" cy="205" r="50" />
        <circle cx="362" cy="205" r="50" />
        <rect x="236" y="205" width="40" height="158" rx="20" />
      </g>
    </svg>
  );
}

export function BrandWordmark({ className = "", turnoClass = "text-ink", size = "text-2xl" }: { className?: string; turnoClass?: string; size?: string }) {
  return (
    <span className={`font-bold tracking-tight ${size} ${className}`}>
      <span className={turnoClass}>turno</span><span className="text-brand">gym</span>
    </span>
  );
}

export function BrandLockup({ iconSize = 36, className = "", turnoClass = "text-ink" }: { iconSize?: number; className?: string; turnoClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={iconSize} className="rounded-[10px]" />
      <BrandWordmark turnoClass={turnoClass} size="text-xl" />
    </span>
  );
}
