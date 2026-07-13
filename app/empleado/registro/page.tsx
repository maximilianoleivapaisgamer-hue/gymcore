"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

/**
 * Registro de EMPLEADO. Crea una cuenta rol "empleado" (vía trigger),
 * vinculada al gimnasio dueño del staff_code que se pasa por link/QR.
 */
export default function EmpleadoRegistroPage() {
  const supabase = createClient();
  const [form, setForm] = useState({ fullName: "", code: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (c) setForm((f) => ({ ...f, code: c }));
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { account_type: "empleado", full_name: form.fullName, staff_code: form.code.trim() } },
    });
    if (err || !data.user) {
      setLoading(false);
      return setError(err?.message || "No se pudo crear la cuenta.");
    }
    window.location.href = "/dashboard";
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-xl">🧑‍💼</div>
          <h1 className="text-2xl font-bold">Sumate al equipo</h1>
          <p className="text-sm text-ink-2">Creá tu cuenta de empleado con el código que te pasó tu gimnasio.</p>
        </div>
        <form onSubmit={register} className="card flex flex-col gap-3">
          <input className="input" placeholder="Tu nombre completo" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
          <input className="input" placeholder="Código del equipo" value={form.code} onChange={(e) => set("code", e.target.value)} required />
          <input className="input" type="email" placeholder="Tu email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          <input className="input" type="password" placeholder="Contraseña" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={6} required />
          {error && <p className="text-sm text-crit">{error}</p>}
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Creando…" : "Crear mi cuenta"}
          </button>
          <p className="text-center text-xs text-muted">
            El código te lo da el dueño del gimnasio (o desde la sección Equipo si ya sos empleado).
          </p>
        </form>
        <p className="mt-4 text-center text-sm text-ink-2">
          ¿Ya tenés cuenta?{" "}
          <Link href="/acceso" className="font-semibold text-brand">Iniciá sesión</Link>
        </p>
      </div>
    </main>
  );
}
