"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { STAFF_PERMS, STAFF_PRESETS, type StaffPerm } from "@/lib/staff";

interface Empleado { id: string; full_name: string | null; created_at: string; permissions: string[] }

export default function EquipoPage() {
  const supabase = createClient();
  const [role, setRole] = useState<string>("owner");
  const [gymId, setGymId] = useState<string | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);

  // Form de alta
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preset, setPreset] = useState("entrenador");
  const [perms, setPerms] = useState<StaffPerm[]>(STAFF_PRESETS[0].perms);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [savingEmp, setSavingEmp] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id, role").eq("id", user.id).single<{ gym_id: string; role: string }>();
    setRole(profile?.role || "owner");
    setGymId(profile?.gym_id ?? null);
    if (profile?.gym_id && profile.role !== "empleado") {
      const { data: emp } = await supabase.from("profiles")
        .select("id, full_name, created_at, permissions").eq("role", "empleado").eq("gym_id", profile.gym_id)
        .order("created_at", { ascending: false });
      setEmpleados((emp as Empleado[]) || []);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function applyPreset(key: string) {
    setPreset(key);
    const p = STAFF_PRESETS.find((x) => x.key === key);
    if (p && key !== "personalizado") setPerms(p.perms);
  }
  function togglePerm(k: StaffPerm) {
    setPreset("personalizado");
    setPerms((ps) => (ps.includes(k) ? ps.filter((x) => x !== k) : [...ps, k]));
  }

  async function crear() {
    if (!gymId) return;
    setErr(""); setMsg("");
    if (!fullName.trim() || !email.trim() || !password) { setErr("Completá nombre, email y contraseña."); return; }
    if (!perms.length) { setErr("Elegí al menos una sección que pueda ver."); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/empleado-alta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gymId, fullName, email, password, permissions: perms }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data?.error || "No se pudo crear."); setCreating(false); return; }
      setMsg(`✅ ${fullName} ya puede entrar con su email y contraseña.`);
      setFullName(""); setEmail(""); setPassword(""); applyPreset("entrenador");
      load();
    } catch { setErr("Falló la conexión."); }
    setCreating(false);
  }

  async function toggleEmpPerm(emp: Empleado, k: StaffPerm) {
    if (!gymId) return;
    const next = emp.permissions.includes(k) ? emp.permissions.filter((x) => x !== k) : [...emp.permissions, k];
    setSavingEmp(emp.id);
    const { error } = await supabase.from("profiles").update({ permissions: next }).eq("id", emp.id);
    setSavingEmp(null);
    if (!error) setEmpleados((es) => es.map((e) => (e.id === emp.id ? { ...e, permissions: next } : e)));
  }

  async function quitar(emp: Empleado) {
    if (!gymId) return;
    if (!confirm(`¿Quitar a ${emp.full_name || "este empleado"} del equipo? Se elimina su acceso.`)) return;
    setSavingEmp(emp.id);
    try {
      const res = await fetch("/api/empleado-baja", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gymId, userId: emp.id }),
      });
      const data = await res.json();
      if (data.ok) setEmpleados((es) => es.filter((e) => e.id !== emp.id));
    } catch { /* noop */ }
    setSavingEmp(null);
  }

  if (loading) return <main className="p-8 text-center text-ink-2">Cargando…</main>;
  if (role === "empleado") return <main className="p-8 text-center text-ink-2">Esta sección es solo para el dueño del gimnasio.</main>;

  return (
    <main className="p-5 md:p-7">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
          <Link href="/dashboard" className="hover:text-brand">Panel</Link>
          <span>/</span><span>Equipo</span>
        </div>
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="text-ink-2">Creá las cuentas de tus empleados y elegí qué puede ver cada uno.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Alta de empleado */}
        <div className="card">
          <div className="mb-3 text-sm font-semibold">Nuevo empleado</div>
          <label className="mb-1 block text-xs font-semibold text-ink-2">Nombre y apellido</label>
          <input className="input mb-3" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej: Lucía Gómez" />

          <label className="mb-1 block text-xs font-semibold text-ink-2">Email (será su usuario)</label>
          <input className="input mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="lucia@email.com" />

          <label className="mb-1 block text-xs font-semibold text-ink-2">Contraseña</label>
          <input className="input mb-3" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />

          <label className="mb-1 block text-xs font-semibold text-ink-2">Tipo</label>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {STAFF_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={`rounded-lg border p-2 text-xs font-semibold transition ${preset === p.key ? "border-brand bg-white/5 text-brand" : "border-white/10 text-ink-2 hover:bg-white/5"}`}
                title={p.desc}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs font-semibold text-ink-2">Puede ver</label>
          <div className="mb-4 grid grid-cols-2 gap-1.5">
            {STAFF_PERMS.map((sp) => (
              <label key={sp.key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs">
                <input type="checkbox" checked={perms.includes(sp.key)} onChange={() => togglePerm(sp.key)} />
                {sp.label}
              </label>
            ))}
          </div>

          {err && <p className="mb-2 text-sm text-crit">{err}</p>}
          {msg && <p className="mb-2 text-sm text-brand">{msg}</p>}
          <button className="btn btn-primary w-full" onClick={crear} disabled={creating}>
            {creating ? "Creando…" : "Crear empleado"}
          </button>
          <p className="mt-3 text-[11px] text-muted">
            El empleado entra en <Link href="/acceso" className="text-brand">iniciar sesión</Link> con el email y la contraseña que le pusiste.
          </p>
        </div>

        {/* Lista de empleados */}
        <div className="card p-0">
          <div className="border-b border-white/10 p-4 text-sm font-semibold">Empleados ({empleados.length})</div>
          {empleados.length === 0 ? (
            <p className="p-8 text-center text-ink-2">Todavía no cargaste empleados. Creá el primero acá al lado.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {empleados.map((e) => (
                <li key={e.id} className="p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{e.full_name || "Sin nombre"}</div>
                      <div className="text-xs text-muted">Alta el {new Date(e.created_at).toLocaleDateString("es-AR")}</div>
                    </div>
                    <button
                      className="text-xs text-crit hover:underline disabled:opacity-50"
                      onClick={() => quitar(e)}
                      disabled={savingEmp === e.id}
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STAFF_PERMS.map((sp) => {
                      const on = e.permissions.includes(sp.key);
                      return (
                        <button
                          key={sp.key}
                          onClick={() => toggleEmpPerm(e, sp.key)}
                          disabled={savingEmp === e.id}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${on ? "border-brand bg-[rgba(34,211,238,.12)] text-brand" : "border-white/10 text-ink-2 hover:bg-white/5"}`}
                          title={on ? "Tocá para quitar" : "Tocá para dar acceso"}
                        >
                          {on ? "✓ " : ""}{sp.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
