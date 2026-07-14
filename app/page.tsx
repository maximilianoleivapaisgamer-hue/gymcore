import Link from "next/link";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";

/** Home del SaaS turnogym (marketing simple + accesos). */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <BrandMark size={64} className="rounded-2xl" />
      <BrandWordmark size="text-4xl" />
      <h1 className="text-3xl font-bold tracking-tight">
        El sistema premium para tu gimnasio
      </h1>
      <p className="max-w-lg text-ink-2">
        Gestioná socios, rutinas, clases, finanzas y el acceso. Tu página pública
        white-label y el portal del socio, todo en un solo lugar.
      </p>
      <div className="flex gap-3">
        <Link href="/dashboard/configuracion" className="btn btn-primary">
          Entrar al panel
        </Link>
        <Link href="/planes" className="btn btn-ghost">
          Ver planes
        </Link>
      </div>
    </main>
  );
}
