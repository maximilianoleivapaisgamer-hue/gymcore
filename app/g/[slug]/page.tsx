"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { redirectForRole } from "@/lib/roles";
import type { UserRole } from "@/types/db";
import ThemeApply from "@/components/ThemeApply";
import AppBackground from "@/components/AppBackground";

/**
 * Login propio del gimnasio (white-label): /g/<slug>.
 * Muestra el logo, el nombre y el color del gimnasio, y el socio entra con su
 * DNI. No aparece "Registrá tu gimnasio" (eso es solo para dueños, en /acceso).
 */
interface GymBrand {
  name: string;
  logo_url: string | null;
  theme: string;
  bg_style: string;
}

export default function GymLoginPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const [gym, setGym] = useState<GymBrand | null>(null);
  const [missing, setMissing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("gyms")
        .select("name, logo_url, theme, bg_style")
        .eq("slug", params.slug)
        .maybeSingle<GymBrand>();
      if (!data) setMissing(true);
      else setGym(data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const id = email.trim();
    const loginId = id.includes("@") ? id : `${id}@socios.gymcore.app`;
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: loginId, password });
    if (authErr || !data.user) {
      setLoading(false);
      return setError("DNI/email o contraseña incorrectos.");
    }
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", data.user.id).single<{ role: UserRole }>();
    window.location.href = redirectForRole(profile?.role);
  }

  if (missing) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold">Gimnasio no encontrado</h1>
          <p className="mt-2 text-ink-2">Revisá el link que te pasó tu gimnasio.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <ThemeApply theme={gym?.theme} />
      <AppBackground style={gym?.bg_style} />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 text-center">
          {gym?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gym.logo_url} alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl bg-white/5 object-contain p-1" />
          ) : (
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-2xl text-[#04121a]">
              💪
            </div>
          )}
          <h1 className="text-2xl font-bold">{gym?.name || "Iniciá sesión"}</h1>
          <p className="text-sm text-ink-2">Accedé con tu DNI</p>
        </div>
        <form onSubmit={login} className="card flex flex-col gap-3">
          <input className="input" type="text" placeholder="DNI o email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-crit">{error}</p>}
          <button className="btn btn-primary" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">{gym?.name || "GymCore"} · Acceso de socios</p>
      </div>
    </main>
  );
}
