import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

/** Panel del dueño (placeholder — se construye en las próximas sesiones). */
export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/acceso");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Panel del gimnasio</h1>
      <p className="mt-1 text-ink-2">Bienvenido. Empezá configurando tu página pública.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/configuracion" className="card hover:border-brand/40">
          <b>Configurar mi página pública</b>
          <p className="mt-1 text-sm text-ink-2">Logo, foto, colores y textos.</p>
        </Link>
        <Link href="/dashboard/socios" className="card hover:border-brand/40">
          <b>Socios</b>
          <p className="mt-1 text-sm text-ink-2">Gestión de miembros (próximamente).</p>
        </Link>
      </div>
    </main>
  );
}
