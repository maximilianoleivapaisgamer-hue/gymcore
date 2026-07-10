import Link from "next/link";

/** Home del SaaS GymCore (marketing simple + accesos). */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-2xl">
        💪
      </div>
      <h1 className="text-4xl font-bold tracking-tight">
        GymCore — el sistema premium para tu gimnasio
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
