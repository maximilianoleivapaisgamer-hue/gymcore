"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

/**
 * Registro del DUEÑO de gimnasio (el cliente que paga el SaaS).
 *
 * El trigger `handle_new_user` (en la base) crea el perfil, el gimnasio y la
 * suscripción de prueba leyendo esta metadata. Así no dependemos de la sesión
 * ni de RLS del navegador.
 *
 * ⚠️ Cada campo que se agrega acá hace que menos gente termine el formulario.
 * Los que están, están porque sirven para LAS DOS PUNTAS:
 *
 *   WhatsApp   → nosotros podemos contactarlo, y es el número con el que su
 *                negocio le manda los recordatorios a sus socios.
 *   Dirección  → sabemos dónde está, y es lo que va en su página pública.
 *   Rubro      → no le hablamos igual a un estudio de pilates de 20 alumnas
 *                que a un gimnasio de musculación de 400.
 *
 * Lo que NO se pregunta acá y va después de crear la cuenta: cuántos socios
 * tiene y cómo nos conoció. Si abandona en esa pantalla, el lead ya está.
 */

const RUBROS = [
  { valor: "gimnasio", texto: "Gimnasio / musculación" },
  { valor: "pilates", texto: "Pilates / reformer" },
  { valor: "danza", texto: "Danza / baile" },
  { valor: "funcional", texto: "Funcional / crossfit" },
  { valor: "artes-marciales", texto: "Artes marciales / boxeo" },
  { valor: "personal", texto: "Entrenador personal" },
  { valor: "otro", texto: "Otro" },
];

export default function RegistroPage() {
  const supabase = createClient();
  const [form, setForm] = useState({
    fullName: "", gymName: "", whatsapp: "", address: "", rubro: "", email: "", password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  /**
   * El WhatsApp, dejado como se marca de verdad.
   *
   * La gente lo escribe de seis maneras distintas: con 0, con 15, con guiones,
   * con +54. Se limpia acá y se guarda parejo, porque este número después se
   * usa para armar los links de wa.me y uno mal escrito no abre nada.
   */
  function limpiarWhatsapp(v: string): string {
    const soloNumeros = v.replace(/\D/g, "");
    if (!soloNumeros) return "";
    if (soloNumeros.startsWith("54")) return `+${soloNumeros}`;
    // 011 15 4444-5555 → se le sacan el 0 de adelante y el 15.
    const sinCero = soloNumeros.replace(/^0/, "");
    return `+54${sinCero.replace(/^(\d{2,4})15/, "$1")}`;
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const whatsapp = limpiarWhatsapp(form.whatsapp);
    if (whatsapp.replace(/\D/g, "").length < 10) {
      setLoading(false);
      return setError("Revisá el WhatsApp: nos hace falta para poder ayudarte.");
    }

    const { data: signUp, error: signErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          gym_name: form.gymName,
          whatsapp,
          address: form.address.trim(),
          rubro: form.rubro,
        },
      },
    });
    if (signErr || !signUp.user) {
      setLoading(false);
      return setError(signErr?.message || "No se pudo crear la cuenta.");
    }

    // Navegación completa: manda las cookies frescas al servidor (evita el rebote a /acceso).
    window.location.href = "/dashboard/configuracion";
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Registrá tu gimnasio</h1>
          <p className="text-sm text-ink-2">7 días de prueba gratis. Sin tarjeta.</p>
        </div>

        <form onSubmit={register} className="card flex flex-col gap-3">
          <input className="input" placeholder="Tu nombre" value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)} autoComplete="name" required />

          <input className="input" placeholder="Nombre del gimnasio" value={form.gymName}
            onChange={(e) => set("gymName", e.target.value)} required />

          <select className="input" value={form.rubro}
            onChange={(e) => set("rubro", e.target.value)} required>
            <option value="">— ¿Qué tipo de negocio es? —</option>
            {RUBROS.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
          </select>

          <div>
            <input className="input w-full" type="tel" placeholder="WhatsApp (ej: 351 123 4567)"
              value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)}
              autoComplete="tel" required />
            <p className="mt-1 px-1 text-[11px] leading-snug text-muted">
              Te escribimos si necesitás una mano para arrancar. Es también el número
              con el que después le vas a mandar los avisos a tus socios.
            </p>
          </div>

          <input className="input" placeholder="Dirección del local" value={form.address}
            onChange={(e) => set("address", e.target.value)} autoComplete="street-address" required />

          <input className="input" type="email" placeholder="Email" value={form.email}
            onChange={(e) => set("email", e.target.value)} autoComplete="email" required />

          <input className="input" type="password" placeholder="Contraseña" value={form.password}
            onChange={(e) => set("password", e.target.value)}
            autoComplete="new-password" minLength={6} required />

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

        {/* Las tiendas y la ley piden que estas dos esten a la vista antes de crear la cuenta. */}
        <p className="mt-6 text-center text-xs text-muted">
          Al crear la cuenta aceptás los{" "}
          <Link href="/terminos" className="hover:text-brand">Términos</Link>
          {" y la "}
          <Link href="/privacidad" className="hover:text-brand">Privacidad</Link>.
        </p>
      </div>
    </main>
  );
}
