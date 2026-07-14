"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { redirectForRole } from "@/lib/roles";
import type { UserRole } from "@/types/db";
import AppBackground from "@/components/AppBackground";
import { BrandMark } from "@/components/BrandMark";

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

    // Los dueños/empleados entran con email; los socios con su DNI (que se
    // convierte al email sintético con el que se creó su cuenta).
    const id = email.trim();
    const loginId = id.includes("@") ? id : `${id}@socios.gymcore.app`;

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginId,
      password,
    });
    if (authError || !data.user) {
      setLoading(false);
      return setError("Usuario/email o contraseña incorrectos.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single<{ role: UserRole }>();

    window.location.href = redirectForRole(profile?.role);
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <AppBackground style="aurora" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-center">
          <BrandMark size={52} className="mx-auto mb-3 rounded-2xl" />
          <h1 className="text-2xl font-bold">Iniciá sesión</h1>
          <p className="text-sm text-ink-2">Accedé a tu panel de turnogym</p>
        </div>
        <form onSubmit={login} className="card flex flex-col gap-3">
          <input
            className="input"
            type="text"
            placeholder="Email o DNI"
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
