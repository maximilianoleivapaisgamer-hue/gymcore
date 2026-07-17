"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { redirectForRole } from "@/lib/roles";
import type { UserRole } from "@/types/db";
import AppBackground from "@/components/AppBackground";
import { BrandMark } from "@/components/BrandMark";
import PasswordInput from "@/components/PasswordInput";

/**
 * Poner una contraseña nueva. Se llega acá de dos formas:
 *  - desde el link del mail de "recuperar" (sesión de recovery), o
 *  - estando logueado, para cambiar la clave a mano.
 * En ambos casos hay una sesión activa y usamos updateUser({ password }).
 */
export default function NuevaClavePage() {
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false); // hay sesión (recovery o logueado)
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setReady(true);
        setChecking(false);
      }
    });

    (async () => {
      // ¿Ya hay sesión (logueado, o recovery ya resuelta)?
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
        setChecking(false);
        return;
      }
      // Flujo PKCE: cambiar el ?code=... por una sesión.
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) await supabase.auth.exchangeCodeForSession(code);
      } catch {
        /* ignore */
      }
      const { data: d2 } = await supabase.auth.getSession();
      if (d2.session) setReady(true);
      // Le damos un momento por si onAuthStateChange resuelve el token del hash.
      setTimeout(() => setChecking(false), 1200);
    })();

    return () => sub.subscription.unsubscribe();
    /* eslint-disable-next-line */
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pass.length < 6) return setError("La contraseña tiene que tener al menos 6 caracteres.");
    if (pass !== pass2) return setError("Las dos contraseñas no coinciden.");
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: pass });
    setSaving(false);
    if (err) return setError(err.message || "No se pudo actualizar la contraseña.");
    setDone(true);
    // Redirigir a su panel según el rol.
    const { data: { user } } = await supabase.auth.getUser();
    let role: UserRole | null = null;
    if (user) {
      const { data: prof } = await supabase
        .from("profiles").select("role").eq("id", user.id).single<{ role: UserRole }>();
      role = prof?.role ?? null;
    }
    setTimeout(() => { window.location.href = redirectForRole(role); }, 1600);
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <AppBackground style="aurora" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-center">
          <BrandMark size={52} className="mx-auto mb-3 rounded-2xl" />
          <h1 className="text-2xl font-bold">Nueva contraseña</h1>
          <p className="text-sm text-ink-2">Elegí una clave nueva para tu cuenta</p>
        </div>

        {checking ? (
          <div className="card text-center text-ink-2">Verificando el link…</div>
        ) : done ? (
          <div className="card text-center">
            <div className="mb-2 text-3xl">✅</div>
            <p className="text-sm text-ink">¡Listo! Tu contraseña quedó cambiada.</p>
            <p className="mt-1 text-xs text-ink-2">Te estamos llevando a tu panel…</p>
          </div>
        ) : ready ? (
          <form onSubmit={submit} className="card flex flex-col gap-3">
            <PasswordInput
              value={pass}
              onChange={setPass}
              placeholder="Nueva contraseña"
              autoComplete="new-password"
              required
            />
            <PasswordInput
              value={pass2}
              onChange={setPass2}
              placeholder="Repetir la contraseña"
              autoComplete="new-password"
              required
            />
            {error && <p className="text-sm text-crit">{error}</p>}
            <button className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        ) : (
          <div className="card text-center">
            <div className="mb-2 text-3xl">⏳</div>
            <p className="text-sm text-ink">
              El link no es válido o ya venció. Pedí uno nuevo desde “Olvidé mi contraseña”.
            </p>
            <Link href="/recuperar" className="btn btn-primary mt-4 inline-block">
              Pedir un link nuevo
            </Link>
          </div>
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
