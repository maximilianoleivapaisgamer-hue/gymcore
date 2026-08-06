import Link from "next/link";
import AppBackground from "@/components/AppBackground";
import { BrandMark } from "@/components/BrandMark";

/**
 * Pantalla pública para probar la demo SIN registro: el prospecto elige entrar
 * como dueño del gimnasio o como socio (app del cliente) y entra directo.
 * La usan /demo (demo pública) y /demo/[slug] (una demo puntual).
 */
export default function DemoChooser({
  nombre,
  ownerHref,
  socioHref,
  logoUrl,
  activarHref,
}: {
  nombre?: string;
  ownerHref: string;
  socioHref: string;
  logoUrl?: string | null;
  activarHref?: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <AppBackground style="aurora" />
      <div className="relative z-10 w-full max-w-md text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={nombre || "Logo"} className="mx-auto mb-4 h-16 w-16 rounded-2xl object-contain" />
        ) : (
          <BrandMark size={56} className="mx-auto mb-4 rounded-2xl" />
        )}
        <h1 className="text-3xl font-bold">Probá {nombre || "turnogym"}</h1>
        <p className="mt-2 text-ink-2">
          Entrá sin registrarte y con todo cargado (5 socios, rutinas, dietas, clases y caja). Elegí desde dónde querés mirarlo:
        </p>

        <div className="mt-7 flex flex-col gap-3 text-left">
          <a href={ownerHref}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-surface p-4 transition hover:border-brand/40 hover:bg-white/[.04]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[rgba(34,211,238,.12)] text-2xl">🖥️</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Entrar como dueño del gimnasio</span>
              <span className="block text-sm text-ink-2">Panel de gestión: socios, cobros, rutinas con IA, clases.</span>
            </span>
            <span className="shrink-0 text-brand transition group-hover:translate-x-0.5">→</span>
          </a>

          <a href={socioHref}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-surface p-4 transition hover:border-brand/40 hover:bg-white/[.04]">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[rgba(34,211,238,.12)] text-2xl">📲</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Entrar como socio (app del cliente)</span>
              <span className="block text-sm text-ink-2">Lo que ve tu cliente: su rutina, progreso y peso.</span>
            </span>
            <span className="shrink-0 text-brand transition group-hover:translate-x-0.5">→</span>
          </a>
        </div>

        <p className="mt-6 text-xs text-muted">Es una demo de prueba. Podés tocar todo sin miedo.</p>
        {activarHref ? (
          <a href={activarHref} className="btn btn-primary mt-4 inline-block w-full text-center">✅ Activar mi gimnasio</a>
        ) : (
          <p className="mt-4 text-sm">
            <Link href="/registro" className="font-semibold text-brand hover:underline">¿Te gustó? Registrá tu gimnasio →</Link>
          </p>
        )}
      </div>
    </main>
  );
}
