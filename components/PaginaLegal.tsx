import Link from "next/link";
import { LEGAL, whatsappLegible } from "@/lib/legal";

/**
 * El marco de /privacidad y /terminos.
 *
 * Son páginas PÚBLICAS a propósito: las tiendas piden una URL abierta, sin
 * login, y el revisor tiene que poder leerla antes de aprobar la app.
 *
 * Texto ancho de lectura (~70 caracteres) y tipografía más grande que el resto
 * del panel: esto se lee de corrido, no se escanea.
 */
export default function PaginaLegal({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:py-16">
      <Link href="/" className="text-sm text-ink-2 transition hover:text-brand">
        ← Volver a {LEGAL.sitio}
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">{titulo}</h1>
      <p className="mt-3 text-ink-2">{bajada}</p>
      <p className="mt-1 text-xs text-muted">Última actualización: {LEGAL.actualizado}</p>

      <div className="legal mt-10">{children}</div>

      <div className="mt-12 rounded-xl border border-white/10 bg-surface p-5">
        <h2 className="text-base font-semibold">¿Dudas o reclamos?</h2>
        <p className="mt-1.5 text-sm text-ink-2">
          Escribinos y te contestamos. Somos {LEGAL.responsable}, en {LEGAL.pais}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`mailto:${LEGAL.email}`} className="btn btn-primary text-sm">
            {LEGAL.email}
          </a>
          <a
            href={`https://wa.me/549${LEGAL.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost text-sm"
          >
            WhatsApp {whatsappLegible()}
          </a>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        <Link href="/privacidad" className="hover:text-brand">Privacidad</Link>
        {" · "}
        <Link href="/terminos" className="hover:text-brand">Términos</Link>
      </p>
    </main>
  );
}
