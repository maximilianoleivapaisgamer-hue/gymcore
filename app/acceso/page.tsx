"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { redirectForRole } from "@/lib/roles";
import type { UserRole } from "@/types/db";

/** Login. Tras autenticar, redirige según el rol del usuario. */
export default function AccesoPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError || !data.user) {
      setLoading(false);
      return setError("Email o contraseña incorrectos.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single<{ role: UserRole }>();

    router.push(redirectForRole(profile?.role));
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-xl">
            💪
          </div>
          <h1 className="text-2xl font-bold">Iniciá sesión</h1>
          <p className="text-sm text-ink-2">Accedé a tu panel de GymCore</p>
        </div>
        <form onSubmit={login} className="card flex flex-col gap-3">
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-crit">{error}</p>}
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-2">
          ¿No tenés cuenta?{" "}
          <Link href="/registro" className="text-brand font-semibold">
            Registrá tu gimnasio
          </Link>
        </p>
      </div>
    </main>
  );
}
