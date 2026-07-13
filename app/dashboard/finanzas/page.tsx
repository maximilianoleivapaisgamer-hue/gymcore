"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { PAY_METHODS, type PayMethod } from "@/types/db";

interface Entry {
  id: string;
  concept: string | null;
  type: "income" | "expense";
  amount: number;
  method: PayMethod | null;
  date: string;
}
interface Member { id: string; full_name: string; plan_price: number | null; membership_expiry: string | null; }

/** Para los COBROS dejamos solo estos 3 medios (efectivo, transferencia, terminal/POS). */
const COBRO_METHODS: { value: string; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "terminal", label: "Terminal (POS)" },
];
const methodLabel = (m: string | null) =>
  COBRO_METHODS.find((x) => x.value === m)?.label ||
  PAY_METHODS.find((x) => x.value === m)?.label || "—";

const money = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-AR");

function ym(d: Date) { return { y: d.getFullYear(), m: d.getMonth() }; }
function pad(n: number) { return String(n).padStart(2, "0"); }
function monthStart(y: number, m: number) { return `${y}-${pad(m + 1)}-01`; }
function nextMonthStart(y: number, m: number) {
  return m === 11 ? `${y + 1}-01-01` : `${y}-${pad(m + 2)}-01`;
}
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const emptyForm = () => ({
  type: "income" as "income" | "expense",
  concept: "",
  amount: "",
  method: "efectivo" as string,
  date: new Date().toISOString().slice(0, 10),
  member_id: "",
});

export default function FinanzasPage() {
  const supabase = createClient();
  const today = new Date();
  const [gymId, setGymId] = useState<string | null>(null);
  const [cur, setCur] = useState(ym(today));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [dayDate, setDayDate] = useState(new Date().toISOString().slice(0, 10));

  async function load(y: number, m: number) {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id, role").eq("id", user.id).single<{ gym_id: string; role: string }>();
    setGymId(profile?.gym_id ?? null);
    if (profile?.role === "empleado" && profile.gym_id) {
      const { data: g } = await supabase.from("gyms").select("employees_see_finance")
        .eq("id", profile.gym_id).maybeSingle<{ employees_see_finance: boolean }>();
      if (!g?.employees_see_finance) { setBlocked(true); setLoading(false); return; }
    }
    const [{ data: ent }, { data: mem }] = await Promise.all([
      supabase.from("cashflow_entries").select("id, concept, type, amount, method, date")
        .gte("date", monthStart(y, m)).lt("date", nextMonthStart(y, m))
        .order("date", { ascending: false }),
      supabase.from("members").select("id, full_name, plan_price, membership_expiry").order("full_name"),
    ]);
    setEntries((ent as Entry[]) || []);
    setMembers((mem as Member[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(cur.y, cur.m); /* eslint-disable-next-line */ }, [cur.y, cur.m]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of entries) {
      if (e.type === "income") income += Number(e.amount);
      else expense += Number(e.amount);
    }
    return { income, expense, balance: income - expense };
  }, [entries]);

  // Abonos a cobrar: socios con la membresía vencida (o venciendo hoy) → plata pendiente de cobro.
  const abonosACobrar = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let count = 0, sum = 0;
    for (const m of members) {
      if (m.membership_expiry && m.membership_expiry <= today) { count++; sum += Number(m.plan_price || 0); }
    }
    return { count, sum };
  }, [members]);

  // Ingresos del mes desglosados por medio de cobro.
  const byMethod = useMemo(() => {
    const acc: Record<string, number> = { efectivo: 0, transferencia: 0, terminal: 0 };
    for (const e of entries) {
      if (e.type === "income" && e.method && e.method in acc) acc[e.method] += Number(e.amount);
    }
    return acc;
  }, [entries]);

  // Ingresos / egresos de un día puntual (elegible con el date picker).
  const dayTotals = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of entries) {
      if (e.date === dayDate) { if (e.type === "income") income += Number(e.amount); else expense += Number(e.amount); }
    }
    return { income, expense };
  }, [entries, dayDate]);

  function prevMonth() { setCur((c) => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }); }
  function nextMonth() { setCur((c) => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }); }

  const setF = (k: keyof ReturnType<typeof emptyForm>, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function pickMember(id: string) {
    const m = members.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      member_id: id,
      concept: m ? `Cuota — ${m.full_name}` : f.concept,
      amount: m?.plan_price ? String(m.plan_price) : f.amount,
    }));
  }

  async function save() {
    if (!gymId || !form.amount) return;
    setSaving(true);
    const { error } = await supabase.from("cashflow_entries").insert({
      gym_id: gymId,
      member_id: form.member_id || null,
      concept: form.concept || (form.type === "income" ? "Ingreso" : "Egreso"),
      type: form.type,
      amount: Number(form.amount),
      method: form.method,
      date: form.date || new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (!error) {
      setModal(false); setForm(emptyForm());
      // si el movimiento cae en el mes visible, recargar
      load(cur.y, cur.m);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este movimiento?")) return;
    await supabase.from("cashflow_entries").delete().eq("id", id);
    setEntries((es) => es.filter((e) => e.id !== id));
  }

  function openNew(type: "income" | "expense") {
    setForm({ ...emptyForm(), type });
    setModal(true);
  }

  if (blocked) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="mb-2 text-4xl">🔒</div>
        <h1 className="text-2xl font-bold">Sin acceso a Finanzas</h1>
        <p className="mt-2 text-ink-2">El dueño del gimnasio no habilitó a los empleados para ver este módulo.</p>
        <Link href="/dashboard" className="btn btn-primary mt-5 inline-block">Volver al panel</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link>
            <span>/</span><span>Finanzas</span>
          </div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <p className="text-ink-2">Caja del gimnasio — ingresos y egresos por mes.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => openNew("expense")}>− Egreso</button>
          <button className="btn btn-primary" onClick={() => openNew("income")}>+ Ingreso</button>
        </div>
      </div>

      {/* Selector de mes */}
      <div className="mb-4 flex items-center gap-3">
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-surface-2 hover:border-white/25" onClick={prevMonth}>‹</button>
        <span className="min-w-[160px] text-center font-semibold">{MONTHS[cur.m]} {cur.y}</span>
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-surface-2 hover:border-white/25" onClick={nextMonth}>›</button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-muted">Ingresos</div>
          <div className="mt-1 text-3xl font-bold text-good">{loading ? "…" : money(totals.income)}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-muted">Egresos</div>
          <div className="mt-1 text-3xl font-bold text-crit">{loading ? "…" : money(totals.expense)}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-muted">Balance</div>
          <div className={`mt-1 text-3xl font-bold ${totals.balance >= 0 ? "text-brand" : "text-crit"}`}>
            {loading ? "…" : money(totals.balance)}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-muted">Abonos a cobrar</div>
          <div className="mt-1 text-3xl font-bold text-warn">{loading ? "…" : money(abonosACobrar.sum)}</div>
          <div className="mt-1 text-xs text-ink-2">{abonosACobrar.count} socio(s) con cuota vencida</div>
        </div>
      </div>

      {/* Cobros por medio de pago (mes) */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-muted">💵 Efectivo</div>
          <div className="mt-1 text-2xl font-bold">{loading ? "…" : money(byMethod.efectivo)}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-muted">🏦 Transferencia</div>
          <div className="mt-1 text-2xl font-bold">{loading ? "…" : money(byMethod.transferencia)}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-muted">💳 Terminal (POS)</div>
          <div className="mt-1 text-2xl font-bold">{loading ? "…" : money(byMethod.terminal)}</div>
        </div>
      </div>

      {/* Ingresos / egresos de un día puntual (con selector de fecha) */}
      <div className="mt-4 card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">Ingresos y egresos del día</div>
          <input className="input max-w-[180px]" type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-wide text-muted">Ingresos del día</div>
            <div className="mt-1 text-2xl font-bold text-good">{loading ? "…" : money(dayTotals.income)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-xs uppercase tracking-wide text-muted">Egresos del día</div>
            <div className="mt-1 text-2xl font-bold text-crit">{loading ? "…" : money(dayTotals.expense)}</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Elegí otra fecha (del mes que estás viendo) para controlar días anteriores.</p>
      </div>

      <div className="mt-6 card p-0">
        <div className="border-b border-white/10 p-4 text-sm font-semibold">Movimientos</div>
        {loading ? (
          <p className="p-8 text-center text-ink-2">Cargando…</p>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-ink-2">No hay movimientos en {MONTHS[cur.m]}. Registrá un ingreso o egreso.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 pb-3 pt-1">Fecha</th>
                  <th className="px-4 pb-3 pt-1">Concepto</th>
                  <th className="px-4 pb-3 pt-1">Tipo</th>
                  <th className="px-4 pb-3 pt-1">Medio</th>
                  <th className="px-4 pb-3 pt-1 text-right">Monto</th>
                  <th className="px-4 pb-3 pt-1"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-white/10 hover:bg-white/[.02]">
                    <td className="px-4 py-3 text-ink-2">{new Date(e.date + "T00:00:00").toLocaleDateString("es-AR")}</td>
                    <td className="px-4 py-3">{e.concept || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${e.type === "income" ? "bg-[rgba(34,197,94,.14)] text-good" : "bg-[rgba(240,82,82,.14)] text-crit"}`}>
                        {e.type === "income" ? "Ingreso" : "Egreso"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{methodLabel(e.method)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${e.type === "income" ? "text-good" : "text-crit"}`}>
                      {e.type === "income" ? "+" : "−"}{money(Number(e.amount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-ink-2 hover:text-crit" title="Eliminar" onClick={() => remove(e.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setModal(false)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">Nuevo movimiento</h3>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${form.type === "income" ? "border-good bg-[rgba(34,197,94,.12)] text-good" : "border-white/10 bg-surface-2 text-ink-2"}`}
                onClick={() => setF("type", "income")}>Ingreso</button>
              <button
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${form.type === "expense" ? "border-crit bg-[rgba(240,82,82,.12)] text-crit" : "border-white/10 bg-surface-2 text-ink-2"}`}
                onClick={() => setF("type", "expense")}>Egreso</button>
            </div>

            <div className="flex flex-col gap-3">
              {form.type === "income" && members.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs text-ink-2">Cobro a socio (opcional)</label>
                  <select className="input" value={form.member_id} onChange={(e) => pickMember(e.target.value)}>
                    <option value="">— Elegir socio —</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-ink-2">Concepto</label>
                <input className="input" placeholder={form.type === "income" ? "Ej: Cuota mensual" : "Ej: Alquiler, mantenimiento…"}
                  value={form.concept} onChange={(e) => setF("concept", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-ink-2">Monto ($)</label>
                  <input className="input" type="number" placeholder="0" value={form.amount}
                    onChange={(e) => setF("amount", e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-2">Fecha</label>
                  <input className="input" type="date" value={form.date} onChange={(e) => setF("date", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-2">Medio de pago</label>
                <select className="input" value={form.method} onChange={(e) => setF("method", e.target.value)}>
                  {COBRO_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.amount}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
