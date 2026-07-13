"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface Gym {
  id: string; name: string; staff_code: string | null;
  employees_see_finance: boolean; employees_see_income_card: boolean;
}
interface Empleado { id: string; full_name: string | null; created_at: string }

function randomCode() {
  // 8 caracteres alfanuméricos, sin depender de crypto server-side.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export default function EquipoPage() {
  const supabase = createClient();
  const [role, setRole] = useState<string>("owner");
  const [gym, setGym] = useState<Gym | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  async function load() {
    setLoading(true);
    setOrigin(window.location.origin);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id, role").eq("id", user.id).single<{ gym_id: string; role: string }>();
    setRole(profile?.role || "owner");
    if (profile?.gym_id) {
      const { data: g } = await supabase.from("gyms")
        .select("id, name, staff_code, employees_see_finance, employees_see_income_card")
        .eq("id", profile.gym_id).single<Gym>();
      setGym(g ?? null);
      if (profile.role !== "empleado") {
        const { data: emp } = await supabase.from("profiles")
          .select("id, full_name, created_at").eq("role", "empleado").eq("gym_id", profile.gym_id)
          .order("created_at", { ascending: false });
        setEmpleados((emp as Empleado[]) || []);
      }
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function regenerateCode() {
    if (!gym) return;
    if (!confirm("¿Generar un código nuevo? El link/QR anterior dejará de funcionar para nuevas altas.")) return;
    setRegenerating(true);
    const code = randomCode();
    const { error } = await supabase.from("gyms").update({ staff_code: code }).eq("id", gym.id);
    setRegenerating(false);
    if (!error) setGym((g) => (g ? { ...g, staff_code: code } : g));
  }

  async function toggleFlag(key: "employees_see_finance" | "employees_see_income_card") {
    if (!gym) return;
    setSavingFlag(key);
    const next = !gym[key];
    const { error } = await supabase.from("gyms").update({ [key]: next }).eq("id", gym.id);
    setSavingFlag(null);
    if (!error) setGym((g) => (g ? { ...g, [key]: next } : g));
  }

  if (loading) return <main className="p-8 text-center text-ink-2">Cargando…</main>;
  if (!gym) return <main className="p-8 text-center text-ink-2">No se encontró el gimnasio.</main>;

  const inviteUrl = origin && gym.staff_code ? `${origin}/empleado/registro?code=${gym.staff_code}` : "";
  const qrUrl = inviteUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(inviteUrl)}`
    : "";

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
          <Link href="/dashboard" className="hover:text-brand">Panel</Link>
          <span>/</span><span>Equipo</span>
        </div>
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="text-ink-2">
          {role === "empleado"
            ? "Invitá a un compañero para que se sume al equipo del gimnasio."
            : "Invitá empleados y controlá qué pueden ver."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* QR / link de invitación */}
        <div className="card text-center">
          <div className="mb-3 text-xs uppercase tracking-wide text-muted">Invitar empleado</div>
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="QR de invitación al equipo" className="mx-auto h-[180px] w-[180px] rounded-lg border-4 border-brand bg-white p-1" />
          ) : (
            <p className="text-sm text-ink-2">Generá un código para tener tu QR.</p>
          )}
          <div className="mt-3 break-all rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-ink-2">
            {inviteUrl || "—"}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {inviteUrl && (
              <button
                className="btn btn-ghost text-xs"
                onClick={() => { navigator.clipboard.writeText(inviteUrl); }}
              >
                Copiar link
              </button>
            )}
            {role !== "empleado" && (
              <button className="btn btn-ghost text-xs" onClick={regenerateCode} disabled={regenerating}>
                {regenerating ? "Generando…" : "🔄 Generar código nuevo"}
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            Quien escanee este QR o abra el link puede crear su cuenta de empleado y descargar la app.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {role !== "empleado" && (
            <div className="card">
              <div className="mb-3 text-sm font-semibold">Qué pueden ver los empleados</div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                  <div>
                    <div className="font-medium">Módulo Finanzas</div>
                    <div className="text-xs text-ink-2">Ver ingresos, egresos y balance de la caja.</div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--brand,#22d3ee)]"
                    checked={gym.employees_see_finance}
                    disabled={savingFlag === "employees_see_finance"}
                    onChange={() => toggleFlag("employees_see_finance")}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                  <div>
                    <div className="font-medium">Tarjeta &quot;Ingresos activos&quot; del panel</div>
                    <div className="text-xs text-ink-2">Se ve en el panel principal, arriba de todo.</div>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--brand,#22d3ee)]"
                    checked={gym.employees_see_income_card}
                    disabled={savingFlag === "employees_see_income_card"}
                    onChange={() => toggleFlag("employees_see_income_card")}
                  />
                </label>
              </div>
            </div>
          )}

          {role !== "empleado" && (
            <div className="card p-0">
              <div className="border-b border-white/10 p-4 text-sm font-semibold">Empleados ({empleados.length})</div>
              {empleados.length === 0 ? (
                <p className="p-8 text-center text-ink-2">Todavía no se sumó ningún empleado. Compartí el QR o el link.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {empleados.map((e) => (
                    <li key={e.id} className="flex items-center justify-between px-4 py-3">
                      <span>{e.full_name || "Sin nombre"}</span>
                      <span className="text-xs text-muted">
                        Se sumó el {new Date(e.created_at).toLocaleDateString("es-AR")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
