"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import AppBackground from "@/components/AppBackground";
import { BrandMark } from "@/components/BrandMark";

/**
 * "¿Olvidaste tu contraseña?" — autoservicio para dueños/empleados (los que
 * entran con email). Le mandamos un mail con un link para poner una clave nueva.
 * Los socios NO usan esto: su usuario y clave es su DNI.
 */
export default function RecuperarPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const mail = email.trim();
    if (!mail.includes("@")) {
      return setError(
        "Escribí tu email. Si sos socio de un gimnasio, tu usuario y contraseña es tu DNI (no hace falta recuperarla)."
      );
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(mail, {
      redirectTo: `${window.location.origin}/nueva-clave`,
    });
    setLoading(false);
    // Por seguridad no revelamos si el mail existe o no.
    if (err && !/rate|limit/i.test(err.message)) {
      return setError("No pudimos enviar el correo. Probá de nuevo en un rato.");
    }
    setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <AppBackground style="aurora" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-center">
          <BrandMark size={52} className="mx-auto mb-3 rounded-2xl" />
          <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
          <p className="text-sm text-ink-2">Te mandamos un link a tu correo</p>
        </div>

        {sent ? (
          <div className="card text-center">
            <div className="mb-2 text-3xl">📧</div>
            <p className="text-sm text-ink">
              Si <span className="font-semibold">{email.trim()}</span> tiene una cuenta, te llegó un
              correo con un link para poner una contraseña nueva.
            </p>
            <p className="mt-2 text-xs text-ink-2">
              Revisá también la carpeta de spam. El link vence en una hora.
            </p>
            <Link href="/acceso" className="btn btn-primary mt-4 inline-block">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="card flex flex-col gap-3">
            <input
              className="input"
              type="email"
              placeholder="Tu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-crit">{error}</p>}
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Enviando…" : "Enviarme el link"}
            </button>
            <p className="text-center text-[11px] text-ink-2">
              ¿Sos socio de un gimnasio? Tu usuario y clave es tu DNI.
            </p>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-ink-2">
          <Link href="/acceso" className="text-brand font-semibold">
            ← Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
