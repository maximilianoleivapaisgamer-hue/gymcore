"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

/**
 * Registro del DUEÑO de gimnasio (el cliente que paga el SaaS).
 * Crea el usuario (rol owner vía trigger), su gimnasio, lo vincula, y le abre
 * una suscripción en trial. Después lo lleva a configurar su página.
 */
export default function RegistroPage() {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", gymName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function slugify(s: string) {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1) Crear cuenta (el trigger handle_new_user crea el profile con rol owner)
    const { data: signUp, error: signErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    });
    if (signErr || !signUp.user) {
      setLoading(false);
      return setError(signErr?.message || "No se pudo crear la cuenta.");
    }
    const uid = signUp.user.id;

    // 2) Crear el gimnasio del dueño
    const slug = `${slugify(form.gymName)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: gym, error: gymErr } = await supabase
      .from("gyms")
      .insert({ owner_id: uid, name: form.gymName, slug })
      .select("id")
      .single<{ id: string }>();
    if (gymErr || !gym) {
      setLoading(false);
      return setError("Cuenta creada, pero falló crear el gimnasio. Escribinos.");
    }

    // 3) Vincular el profile al gimnasio + abrir suscripción trial (14 días)
    await supabase.from("profiles").update({ gym_id: gym.id }).eq("id", uid);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await supabase.from("subscriptions").insert({
      gym_id: gym.id,
      plan: "basico",
      status: "trial",
      trial_ends_at: trialEnd.toISOString(),
    });

    router.push("/dashboard/configuracion");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Registrá tu gimnasio</h1>
          <p className="text-sm text-ink-2">14 días de prueba gratis. Sin tarjeta.</p>
        </div>
        <form onSubmit={register} className="card flex flex-col gap-3">
          <input className="input" placeholder="Tu nombre" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
          <input className="input" placeholder="Nombre del gimnasio" value={form.gymName} onChange={(e) => set("gymName", e.target.value)} required />
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          <input className="input" type="password" placeholder="Contraseña" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={6} required />
          {error && <p className="text-sm text-crit">{error}</p>}
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-2">
          ¿Ya tenés cuenta?{" "}
          <Link href="/acceso" className="text-brand font-semibold">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
