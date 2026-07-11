"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface Member {
  id: string;
  gym_id: string;
  full_name: string;
  dni: string | null;
  email: string | null;
  whatsapp: string | null;
  plan_name: string | null;
  plan_price: number | null;
  membership_expiry: string | null;
}

const EMPTY: Partial<Member> = {
  full_name: "", dni: "", email: "", whatsapp: "",
  plan_name: "", plan_price: null, membership_expiry: "",
};

const BADGE_BASE = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ";
const BADGES: Record<string, string> = {
  ok: BADGE_BASE + "bg-[rgba(34,197,94,.14)] text-[#4ade80]",
  warn: BADGE_BASE + "bg-[rgba(245,177,61,.14)] text-[#f5b13d]",
  crit: BADGE_BASE + "bg-[rgba(240,82,82,.14)] text-[#f87171]",
  muted: BADGE_BASE + "bg-white/5 text-muted",
};
const MINI = "grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-surface-2 text-sm hover:border-white/25";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function statusOf(expiry: string | null): { label: string; cls: string } {
  if (!expiry) return { label: "Sin plan", cls: "muted" };
  const days = Math.ceil((new Date(expiry + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Vencido", cls: "crit" };
  if (days <= 7) return { label: "Vence pronto", cls: "warn" };
  return { label: "Activo", cls: "ok" };
}

export default function SociosPage() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Member> | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
    setGymId(profile?.gym_id ?? null);
    const { data } = await supabase
      .from("members").select("*").order("created_at", { ascending: false });
    setMembers((data as Member[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter((m) =>
      m.full_name.toLowerCase().includes(q) || (m.dni || "").includes(q));
  }, [members, search]);

  function openNew() { setEditing({ ...EMPTY }); setModal(true); }
  function openEdit(m: Member) { setEditing({ ...m }); setModal(true); }

  async function save() {
    if (!editing || !gymId) return;
    setSaving(true);
    const payload = {
      gym_id: gymId,
      full_name: editing.full_name || "",
      dni: editing.dni || null,
      email: editing.email || null,
      whatsapp: editing.whatsapp || null,
      plan_name: editing.plan_name || null,
      plan_price: editing.plan_price ? Number(editing.plan_price) : null,
      membership_expiry: editing.membership_expiry || null,
    };
    if (editing.id) await supabase.from("members").update(payload).eq("id", editing.id);
    else await supabase.from("members").insert(payload);
    setSaving(false); setModal(false); setEditing(null); load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este socio?")) return;
    await supabase.from("members").delete().eq("id", id);
    load();
  }

  const setF = (k: keyof Member, v: string) =>
    setEditing((e) => (e ? { ...e, [k]: v } : e));

  const vencidos = members.filter((m) => statusOf(m.membership_expiry).cls === "crit").length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link>
            <span>/</span><span>Socios</span>
          </div>
          <h1 className="text-2xl font-bold">Socios</h1>
          <p className="text-ink-2">{members.length} socios · {vencidos} vencidos</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Agregar socio</button>
      </div>

      <div className="card p-0">
        <div className="border-b border-white/10 p-4">
          <input className="input max-w-sm" placeholder="Buscar por nombre o DNI…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <p className="p-8 text-center text-ink-2">Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-ink-2">
            {members.length === 0
              ? "Todavía no tenés socios. Tocá “Agregar socio” para cargar el primero."
              : "Sin resultados para tu búsqueda."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 pb-3 pt-1">Socio</th>
                  <th className="px-4 pb-3 pt-1">DNI</th>
                  <th className="px-4 pb-3 pt-1">Plan</th>
                  <th className="px-4 pb-3 pt-1">Vencimiento</th>
                  <th className="px-4 pb-3 pt-1">Estado</th>
                  <th className="px-4 pb-3 pt-1 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const st = statusOf(m.membership_expiry);
                  return (
                    <tr key={m.id} className="border-t border-white/10 hover:bg-white/[.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-xs font-bold text-black">
                            {initials(m.full_name)}
                          </div>
                          <div>
                            <div className="font-medium">{m.full_name}</div>
                            <div className="text-xs text-muted">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{m.dni || "—"}</td>
                      <td className="px-4 py-3">{m.plan_name || "—"}</td>
                      <td className="px-4 py-3 text-ink-2">
                        {m.membership_expiry ? new Date(m.membership_expiry + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td className="px-4 py-3"><span className={BADGES[st.cls]}>{st.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {m.whatsapp && (
                            <a className={MINI} title="WhatsApp" target="_blank" rel="noreferrer"
                              href={"https://wa.me/" + (m.whatsapp || "").replace(/\D/g, "")}>💬</a>
                          )}
                          <button className={MINI} title="Editar" onClick={() => openEdit(m)}>✏️</button>
                          <button className={MINI} title="Eliminar" onClick={() => remove(m.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setModal(false)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">{editing.id ? "Editar socio" : "Nuevo socio"}</h3>
            <div className="flex flex-col gap-3">
              <input className="input" placeholder="Nombre completo" value={editing.full_name || ""} onChange={(e) => setF("full_name", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="DNI" value={editing.dni || ""} onChange={(e) => setF("dni", e.target.value)} />
                <input className="input" placeholder="WhatsApp" value={editing.whatsapp || ""} onChange={(e) => setF("whatsapp", e.target.value)} />
              </div>
              <input className="input" type="email" placeholder="Email" value={editing.email || ""} onChange={(e) => setF("email", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Nombre del plan" value={editing.plan_name || ""} onChange={(e) => setF("plan_name", e.target.value)} />
                <input className="input" type="number" placeholder="Precio ($)" value={editing.plan_price ?? ""} onChange={(e) => setF("plan_price", e.target.value)} />
              </div>
              <label className="text-xs text-ink-2">Vencimiento de la membresía</label>
              <input className="input" type="date" value={editing.membership_expiry || ""} onChange={(e) => setF("membership_expiry", e.target.value)} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !editing.full_name}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
