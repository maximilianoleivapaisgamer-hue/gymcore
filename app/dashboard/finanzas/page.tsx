"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { PAY_METHODS, type PayMethod } from "@/types/db";
import { resolveActiveSede, type Sede } from "@/lib/sede";

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
  const [sedeId, setSedeId] = useState<string | null>(null);
  const [sedeName, setSedeName] = useState<string>("");
  const [cur, setCur] = useState(ym(today));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [dayDate, setDayDate] = useState(new Date().toISOString().slice(0, 10));
  const [cash6, setCash6] = useState<{ date: string; type: "income" | "expense"; amount: number }[]>([]);

  async function load(y: number, m: number) {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id, role, permissions").eq("id", user.id)
      .single<{ gym_id: string; role: string; permissions: string[] | null }>();
    setGymId(profile?.gym_id ?? null);
    if (profile?.role === "empleado" && !(profile?.permissions || []).includes("finanzas")) {
      setBlocked(true); setLoading(false); return;
    }
    // Sucursal activa: la caja se divide por sede.
    let activeSede: string | null = null;
    if (profile?.gym_id) {
      const { data: sedeList } = await supabase.from("sedes")
        .select("id, gym_id, name, address, created_at").eq("gym_id", profile.gym_id)
        .order("created_at", { ascending: true });
      const arr = (sedeList as Sede[]) || [];
      activeSede = resolveActiveSede(profile.gym_id, arr);
      setSedeId(activeSede);
      setSedeName(arr.find((s) => s.id === activeSede)?.name || "");
    }
    const c6 = new Date(y, m - 5, 1);
    const c6Iso = `${c6.getFullYear()}-${pad(c6.getMonth() + 1)}-01`;
    let qMonth = supabase.from("cashflow_entries").select("id, concept, type, amount, method, date")
      .gte("date", monthStart(y, m)).lt("date", nextMonthStart(y, m));
    let q6 = supabase.from("cashflow_entries").select("date, type, amount")
      .gte("date", c6Iso).lt("date", nextMonthStart(y, m));
    if (activeSede) { qMonth = qMonth.eq("sede_id", activeSede); q6 = q6.eq("sede_id", activeSede); }
    const [{ data: ent }, { data: mem }, { data: cf6 }] = await Promise.all([
      qMonth.order("date", { ascending: false }),
      supabase.from("members").select("id, full_name, plan_price, membership_expiry").order("full_name"),
      q6,
    ]);
    setEntries((ent as Entry[]) || []);
    setMembers((mem as Member[]) || []);
    setCash6((cf6 as { date: string; type: "income" | "expense"; amount: number }[]) || []);
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

  // Flujo mensual: ingresos vs gastos de los últimos 6 meses (hasta el mes visible).
  const flow = useMemo(() => {
    const buckets: { key: string; label: string; ing: number; gas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(cur.y, cur.m - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: MONTHS[d.getMonth()].slice(0, 3), ing: 0, gas: 0 });
    }
    for (const c of cash6) {
      const b = buckets.find((x) => x.key === c.date.slice(0, 7));
      if (!b) continue;
      if (c.type === "income") b.ing += Number(c.amount); else b.gas += Number(c.amount);
    }
    const max = Math.max(1, ...buckets.flatMap((b) => [b.ing, b.gas]));
    return { buckets, max };
  }, [cash6, cur]);

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
      sede_id: sedeId,
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
    <main className="p-5 md:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link>
            <span>/</span><span>Finanzas</span>
          </div>
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <p className="text-ink-2">
            Caja {sedeName ? <>de <span className="font-semibold text-ink">{sedeName}</span></> : "del gimnasio"} — ingresos y egresos por mes.
          </p>
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
        <FinKpi label="Total ingresos" tone="text-good" value={loading ? "…" : money(totals.income)} sub="Suma del mes"
          icon={<path d="M7 17L17 7M17 7H9M17 7v8" />} />
        <FinKpi label="Total gastos" tone="text-crit" value={loading ? "…" : money(totals.expense)} sub="Suma del mes"
          icon={<path d="M17 7L7 17M7 17h8M7 17V9" />} />
        <FinKpi label="Balance neto" tone={totals.balance >= 0 ? "text-brand" : "text-crit"} value={loading ? "…" : money(totals.balance)} sub="Ingresos − egresos"
          icon={<><rect x="2" y="6" width="20" height="13" rx="2" /><path d="M2 10h20" /></>} />
        <FinKpi label="Abonos a cobrar" tone="text-warn" value={loading ? "…" : money(abonosACobrar.sum)} sub={`${abonosACobrar.count} con cuota vencida`}
          icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
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

      {/* Flujo mensual (6 meses) */}
      <div className="mt-4 card">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="text-base font-semibold">Flujo mensual</h3>
          <span className="text-[13px] font-semibold text-brand">Últimos 6 meses</span>
        </div>
        <div className="flex h-[200px] items-end gap-4 pt-2.5">
          {flow.buckets.map((b) => (
            <div key={b.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-full w-full items-end justify-center gap-[5px]">
                <div className="w-4 rounded-t bg-gradient-to-b from-brand to-brand-2" style={{ height: `${(b.ing / flow.max) * 100}%` }} title={money(b.ing)} />
                <div className="w-4 rounded-t bg-[#3b4b63]" style={{ height: `${(b.gas / flow.max) * 100}%` }} title={money(b.gas)} />
              </div>
              <span className="text-[11.5px] text-muted">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-[18px]">
          <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2"><i className="block h-2.5 w-2.5 rounded-[3px] bg-brand" />Ingresos</div>
          <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2"><i className="block h-2.5 w-2.5 rounded-[3px] bg-[#3b4b63]" />Gastos</div>
        </div>
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

function FinKpi({ label, tone, value, sub, icon }: { label: string; tone: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between text-[12.5px] font-medium text-ink-2">
        {label}
        <span className={`grid h-9 w-9 place-items-center rounded-[10px] bg-surface-3 ${tone}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]">{icon}</svg>
        </span>
      </div>
      <div className={`mt-3 text-3xl font-bold tracking-[-.5px] tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1 text-xs text-ink-2">{sub}</div>
    </div>
  );
}
