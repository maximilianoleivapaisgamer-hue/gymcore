"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { PAY_METHODS, type PayMethod, type RealPlan } from "@/types/db";

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
  observacion: string | null;
  reminder_whatsapp: boolean;
  reminder_email: boolean;
}

const EMPTY: Partial<Member> = {
  full_name: "", dni: "", email: "", whatsapp: "",
  plan_name: "", plan_price: null, membership_expiry: "",
  observacion: "", reminder_whatsapp: true, reminder_email: false,
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
  const [plans, setPlans] = useState<RealPlan[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Member> | null>(null);
  const [saving, setSaving] = useState(false);
  // Cobro al alta
  const [charge, setCharge] = useState(false);
  const [method, setMethod] = useState<PayMethod>("efectivo");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
    setGymId(profile?.gym_id ?? null);
    if (profile?.gym_id) {
      const { data: gym } = await supabase
        .from("gyms").select("real_plans").eq("id", profile.gym_id)
        .single<{ real_plans: RealPlan[] }>();
      setPlans(gym?.real_plans || []);
    }
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

  function openNew() { setEditing({ ...EMPTY }); setCharge(false); setMethod("efectivo"); setModal(true); }
  function openEdit(m: Member) { setEditing({ ...m }); setCharge(false); setMethod("efectivo"); setModal(true); }

  // Al elegir un plan del listado, autocompleta nombre y precio.
  function selectPlan(name: string) {
    const p = plans.find((x) => x.name === name);
    setEditing((e) =>
      e ? { ...e, plan_name: name, plan_price: p ? p.price : e.plan_price ?? null } : e
    );
  }

  async function save() {
    if (!editing || !gymId) return;
    setSaving(true);
    const price = editing.plan_price ? Number(editing.plan_price) : null;
    const payload = {
      gym_id: gymId,
      full_name: editing.full_name || "",
      dni: editing.dni || null,
      email: editing.email || null,
      whatsapp: editing.whatsapp || null,
      plan_name: editing.plan_name || null,
      plan_price: price,
      membership_expiry: editing.membership_expiry || null,
      observacion: editing.observacion || null,
      reminder_whatsapp: editing.reminder_whatsapp ?? true,
      reminder_email: editing.reminder_email ?? false,
    };
    let memberId = editing.id || null;
    if (memberId) {
      await supabase.from("members").update(payload).eq("id", memberId);
    } else {
      const { data: inserted } = await supabase.from("members").insert(payload).select("id").single<{ id: string }>();
      memberId = inserted?.id || null;
    }
    // Cobro directo → registra ingreso en la caja, vinculado al socio y al plan cobrado
    if (charge && price && price > 0) {
      await supabase.from("cashflow_entries").insert({
        gym_id: gymId,
        member_id: memberId,
        type: "income",
        amount: price,
        method,
        plan_name: editing.plan_name || null,
        concept: `Cobro plan ${editing.plan_name || ""} · ${editing.full_name || ""}`.trim(),
        date: new Date().toISOString().slice(0, 10),
      });
    }
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
                        <Link href={`/dashboard/socios/${m.id}`} className="flex items-center gap-3 hover:opacity-80">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-xs font-bold text-black">
                            {initials(m.full_name)}
                          </div>
                          <div>
                            <div className="font-medium">{m.full_name}</div>
                            <div className="text-xs text-muted">{m.email}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{m.dni || "—"}</td>
                      <td className="px-4 py-3">{m.plan_name || "—"}</td>
                      <td className="px-4 py-3 text-ink-2">
                        {m.membership_expiry ? new Date(m.membership_expiry + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td className="px-4 py-3"><span className={BADGES[st.cls]}>{st.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link className={MINI} title="Ver detalle" href={`/dashboard/socios/${m.id}`}>👁️</Link>
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

              <label className="text-xs text-ink-2">Plan</label>
              {plans.length > 0 ? (
                <select
                  className="input"
                  value={plans.some((p) => p.name === editing.plan_name) ? editing.plan_name || "" : (editing.plan_name ? "__custom" : "")}
                  onChange={(e) => {
                    if (e.target.value === "__custom") { setF("plan_name", ""); setF("plan_price", ""); }
                    else selectPlan(e.target.value);
                  }}
                >
                  <option value="">Seleccioná un plan…</option>
                  {plans.map((p) => (
                    <option key={p.name} value={p.name}>{p.name} — ${p.price}</option>
                  ))}
                  <option value="__custom">Otro / personalizado</option>
                </select>
              ) : (
                <p className="text-xs text-muted">
                  No cargaste planes todavía. Configuralos en <Link href="/dashboard/configuracion" className="text-brand">Mi página</Link> o escribilos abajo.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Nombre del plan" value={editing.plan_name || ""} onChange={(e) => setF("plan_name", e.target.value)} />
                <input className="input" type="number" placeholder="Precio ($)" value={editing.plan_price ?? ""} onChange={(e) => setF("plan_price", e.target.value)} />
              </div>

              <label className="text-xs text-ink-2">Vencimiento de la membresía</label>
              <input className="input" type="date" value={editing.membership_expiry || ""} onChange={(e) => setF("membership_expiry", e.target.value)} />

              <label className="text-xs text-ink-2">Observación (opcional)</label>
              <textarea className="input" rows={2} placeholder="Ej: con descuento por 3 meses"
                value={editing.observacion || ""} onChange={(e) => setF("observacion", e.target.value)} />

              {/* RECORDATORIOS AUTOMÁTICOS */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-sm font-semibold">Recordatorios automáticos de vencimiento</div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
                    <input type="checkbox" checked={!!editing.reminder_whatsapp}
                      onChange={(e) => setEditing((ed) => (ed ? { ...ed, reminder_whatsapp: e.target.checked } : ed))} />
                    💬 WhatsApp
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
                    <input type="checkbox" checked={!!editing.reminder_email}
                      onChange={(e) => setEditing((ed) => (ed ? { ...ed, reminder_email: e.target.checked } : ed))} />
                    ✉️ Email
                  </label>
                </div>
              </div>

              {/* COBRO DIRECTO */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={charge} onChange={(e) => setCharge(e.target.checked)} />
                  Cobrar ahora {editing.plan_price ? `($${editing.plan_price})` : ""}
                </label>
                {charge && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs text-ink-2">Medio de pago</label>
                    <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                      {PAY_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    {(!editing.plan_price || Number(editing.plan_price) <= 0) && (
                      <p className="mt-2 text-xs text-[#f5b13d]">Cargá un precio para poder registrar el cobro.</p>
                    )}
                  </div>
                )}
              </div>
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
