"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import {
  getActiveSedeId,
  setActiveSedeId,
  sedeLimitFor,
  sedeLimitLabel,
  type Sede,
} from "@/lib/sede";

export default function SedesPage() {
  const supabase = createClient();
  const [role, setRole] = useState("owner");
  const [gymId, setGymId] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Alta
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  // Edición inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddr, setEditAddr] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id, role").eq("id", user.id)
      .single<{ gym_id: string | null; role: string }>();
    setRole(profile?.role || "owner");
    setGymId(profile?.gym_id ?? null);
    if (profile?.gym_id) {
      const [{ data: sub }, { data: list }] = await Promise.all([
        supabase.from("subscriptions").select("plan").eq("gym_id", profile.gym_id).maybeSingle<{ plan: string }>(),
        supabase.from("sedes").select("id, gym_id, name, address, created_at")
          .eq("gym_id", profile.gym_id).order("created_at", { ascending: true }),
      ]);
      setPlan(sub?.plan ?? null);
      const arr = (list as Sede[]) || [];
      setSedes(arr);
      setActiveId(getActiveSedeId(profile.gym_id) || (arr[0]?.id ?? null));
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const limit = sedeLimitFor(plan);
  const atLimit = sedes.length >= limit;

  async function crear() {
    setErr("");
    if (!gymId) return;
    if (!name.trim()) { setErr("Poné un nombre para la sucursal."); return; }
    if (atLimit) { setErr("Llegaste al límite de sucursales de tu plan."); return; }
    setCreating(true);
    const { data, error } = await supabase.from("sedes")
      .insert({ gym_id: gymId, name: name.trim(), address: address.trim() || null })
      .select("id, gym_id, name, address, created_at").single();
    setCreating(false);
    if (error) { setErr("No se pudo crear la sucursal."); return; }
    setSedes((s) => [...s, data as Sede]);
    setName(""); setAddress("");
  }

  function startEdit(s: Sede) {
    setEditId(s.id); setEditName(s.name); setEditAddr(s.address || "");
  }
  async function saveEdit() {
    if (!editId || !editName.trim()) return;
    setSavingEdit(true);
    const { error } = await supabase.from("sedes")
      .update({ name: editName.trim(), address: editAddr.trim() || null }).eq("id", editId);
    setSavingEdit(false);
    if (!error) {
      setSedes((s) => s.map((x) => (x.id === editId ? { ...x, name: editName.trim(), address: editAddr.trim() || null } : x)));
      setEditId(null);
    }
  }

  function usarComoActiva(id: string) {
    if (!gymId) return;
    setActiveSedeId(gymId, id);
    setActiveId(id);
  }

  if (loading) return <main className="p-8 text-center text-ink-2">Cargando…</main>;
  if (role === "empleado") return <main className="p-8 text-center text-ink-2">Esta sección es solo para el dueño del gimnasio.</main>;

  return (
    <main className="p-5 md:p-7">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
          <Link href="/dashboard" className="hover:text-brand">Panel</Link>
          <span>/</span><span>Sucursales</span>
        </div>
        <h1 className="text-2xl font-bold">Sucursales</h1>
        <p className="text-ink-2">
          Tus socios, rutinas y dietas son los mismos en todas las sucursales. Lo que se divide por sucursal es la caja, las clases y el control de acceso.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Alta */}
        <div className="card h-fit">
          <div className="mb-1 text-sm font-semibold">Nueva sucursal</div>
          <p className="mb-3 text-xs text-muted">
            Tu plan permite <span className="font-semibold text-ink-2">{sedeLimitLabel(plan)}</span> {limit === 1 ? "sucursal" : "sucursales"}.
            Vas {sedes.length}{limit === Infinity ? "" : ` de ${limit}`}.
          </p>
          <label className="mb-1 block text-xs font-semibold text-ink-2">Nombre</label>
          <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Sucursal Centro" disabled={atLimit} />
          <label className="mb-1 block text-xs font-semibold text-ink-2">Dirección (opcional)</label>
          <input className="input mb-3" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ej: Av. Rivadavia 1234" disabled={atLimit} />
          {err && <p className="mb-2 text-sm text-crit">{err}</p>}
          <button className="btn btn-primary w-full" onClick={crear} disabled={creating || atLimit}>
            {creating ? "Creando…" : "Agregar sucursal"}
          </button>
          {atLimit && limit !== Infinity && (
            <p className="mt-3 text-[11px] text-muted">
              Para sumar más sucursales, <Link href="/dashboard/mi-plan" className="text-brand">mejorá tu plan</Link>.
              El plan Pro permite hasta 3 y el Elite, ilimitadas.
            </p>
          )}
        </div>

        {/* Lista */}
        <div className="card p-0">
          <div className="border-b border-white/10 p-4 text-sm font-semibold">Mis sucursales ({sedes.length})</div>
          <ul className="divide-y divide-white/10">
            {sedes.map((s) => (
              <li key={s.id} className="p-4">
                {editId === s.id ? (
                  <div className="flex flex-col gap-2">
                    <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nombre" />
                    <input className="input" value={editAddr} onChange={(e) => setEditAddr(e.target.value)} placeholder="Dirección" />
                    <div className="flex gap-2">
                      <button className="btn btn-primary" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? "Guardando…" : "Guardar"}</button>
                      <button className="btn btn-ghost" onClick={() => setEditId(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{s.name}</span>
                        {activeId === s.id && (
                          <span className="rounded-full bg-[rgba(34,211,238,.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">Viendo</span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted">{s.address || "Sin dirección"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {activeId !== s.id && (
                        <button className="text-xs font-semibold text-ink-2 hover:text-brand" onClick={() => usarComoActiva(s.id)}>Ver esta</button>
                      )}
                      <button className="text-xs font-semibold text-ink-2 hover:text-brand" onClick={() => startEdit(s)}>Editar</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="border-t border-white/10 p-4 text-[11px] text-muted">
            Para no perder datos, las sucursales no se pueden eliminar desde acá. Si necesitás dar de baja una, escribinos.
          </p>
        </div>
      </div>
    </main>
  );
}
