"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { redirectForRole } from "@/lib/roles";
import type { UserRole } from "@/types/db";
import AppBackground from "@/components/AppBackground";
import { BrandMark } from "@/components/BrandMark";
import PasswordInput from "@/components/PasswordInput";
import ThemeApply from "@/components/ThemeApply";
import type { MarcaGimnasio } from "@/lib/gimnasio-publico";
import { inicialDe } from "@/lib/gimnasio-publico";

/**
 * El formulario de acceso.
 *
 * Cuando viene `marca`, la pantalla es la del GIMNASIO: su logo, su nombre y
 * sus colores. Es lo que ve el socio que abre la app de su estudio desde el
 * teléfono. Sin `marca`, es la de siempre (turnogym), que es lo que ve el dueño
 * entrando por la web.
 */
export default function FormularioAcceso({ marca }: { marca: MarcaGimnasio | null }) {
  const supabase = createClient();
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
      {marca && <ThemeApply theme={marca.tema} />}
      <AppBackground style={marca?.fondo ?? "aurora"} />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-center">
          {marca ? (
            <>
              {marca.logo ? (
                <img
                  src={marca.logo}
                  alt=""
                  className="mx-auto mb-3 h-[64px] w-[64px] rounded-2xl object-cover"
                />
              ) : (
                // Sin logo cargado, la inicial en el color del gimnasio. Queda
                // prolijo y, sobre todo, sigue siendo distinto en cada app.
                <span
                  className="mx-auto mb-3 grid h-[64px] w-[64px] place-items-center rounded-2xl text-3xl font-bold"
                  style={{
                    background: "linear-gradient(135deg, rgb(var(--brand-rgb)), rgb(var(--brand-2-rgb)))",
                    color: "var(--on-brand)",
                  }}
                >
                  {inicialDe(marca.nombre)}
                </span>
              )}
              <h1 className="text-2xl font-bold">{marca.nombre}</h1>
              <p className="text-sm text-ink-2">Entrá con tu DNI y tu contraseña</p>
            </>
          ) : (
            <>
              <BrandMark size={52} className="mx-auto mb-3 rounded-2xl" />
              <h1 className="text-2xl font-bold">Iniciá sesión</h1>
              <p className="text-sm text-ink-2">Accedé a tu panel de turnogym</p>
            </>
          )}
        </div>

        <form onSubmit={login} className="card flex flex-col gap-3">
          <input
            className="input"
            type="text"
            placeholder={marca ? "DNI" : "Email o DNI"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Contraseña"
            autoComplete="current-password"
            required
          />
          {error && <p className="text-sm text-crit">{error}</p>}
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
          <Link href="/recuperar" className="text-center text-xs text-ink-2 hover:text-brand">
            ¿Olvidaste tu contraseña?
          </Link>
        </form>

        {marca ? (
          // En la app del gimnasio no va "registrá tu gimnasio": el socio no
          // viene a eso, y ofrecerle dar de alta un negocio es justo la clase de
          // pantalla fuera de lugar que hace ruido en la revisión de las tiendas.
          <p className="mt-4 text-center text-sm text-ink-2">
            ¿No podés entrar? Consultá en {marca.nombre}.
          </p>
        ) : (
          <p className="mt-4 text-center text-sm text-ink-2">
            ¿No tenés cuenta?{" "}
            <Link href="/registro" className="text-brand font-semibold">
              Registrá tu gimnasio
            </Link>
          </p>
        )}

        {/* Las tiendas piden que estas dos esten a la vista, sin login. */}
        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/privacidad" className="hover:text-brand">Privacidad</Link>
          {" · "}
          <Link href="/terminos" className="hover:text-brand">Términos</Link>
        </p>
      </div>
    </main>
  );
}
