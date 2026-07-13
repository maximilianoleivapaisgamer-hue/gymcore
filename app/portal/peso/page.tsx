"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface MemberLite { id: string; gym_id: string; height_cm: number | null; }
interface WeightLog { id: string; date: string; weight_kg: number; }

function pad(n: number) { return String(n).padStart(2, "0"); }
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const fdate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export default function PesoPage() {
  const supabase = createClient();
  const [state, setState] = useState<"loading" | "nomember" | "ok">("loading");
  const [member, setMember] = useState<MemberLite | null>(null);
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [height, setHeight] = useState("");
  const [savingHeight, setSavingHeight] = useState(false);
  const [newDate, setNewDate] = useState(todayIso());
  const [newWeight, setNewWeight] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/acceso"; return; }
    const { data: m } = await supabase
      .from("members").select("id, gym_id, height_cm")
      .eq("linked_user_id", user.id).maybeSingle<MemberLite>();
    if (!m) { setState("nomember"); return; }
    setMember(m);
    setHeight(m.height_cm != null ? String(m.height_cm) : "");
    const { data: l } = await supabase
      .from("weight_logs").select("id, date, weight_kg")
      .eq("member_id", m.id).order("date", { ascending: true });
    setLogs((l as WeightLog[]) || []);
    setState("ok");
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function saveHeight() {
    if (!member || !height) return;
    setSavingHeight(true);
    await supabase.from("members").update({ height_cm: Number(height) }).eq("id", member.id);
    setSavingHeight(false);
  }

  async function addLog() {
    if (!member || !newWeight) return;
    setSaving(true);
    const { data, error } = await supabase.from("weight_logs")
      .insert({ gym_id: member.gym_id, member_id: member.id, date: newDate, weight_kg: Number(newWeight) })
      .select("id, date, weight_kg").single<WeightLog>();
    setSaving(false);
    if (!error && data) {
      setLogs((ls) => [...ls.filter((l) => l.date !== data.date), data].sort((a, b) => a.date.localeCompare(b.date)));
      setNewWeight("");
      setNewDate(todayIso());
    }
  }

  async function removeLog(id: string) {
    if (!confirm("¿Eliminar este registro de peso?")) return;
    await supabase.from("weight_logs").delete().eq("id", id);
    setLogs((ls) => ls.filter((l) => l.id !== id));
  }

  const chart = useMemo(() => {
    if (logs.length < 2) return null;
    const W = 600, H = 180, PAD = 24;
    const ws = logs.map((l) => l.weight_kg);
    const min = Math.min(...ws), max = Math.max(...ws);
    const span = max - min || 1;
    const pts = logs.map((l, i) => {
      const x = PAD + (i * (W - PAD * 2)) / (logs.length - 1);
      const y = H - PAD - ((l.weight_kg - min) * (H - PAD * 2)) / span;
      return { x, y };
    });
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return { W, H, path, pts };
  }, [logs]);

  const initial = logs[0]?.weight_kg;
  const current = logs[logs.length - 1]?.weight_kg;
  const delta = initial != null && current != null ? Math.round((current - initial) * 10) / 10 : null;

  if (state === "loading") return <main className="grid min-h-screen place-items-center text-ink-2">Cargando…</main>;
  if (state === "nomember") return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-ink-2">No encontramos tu ficha de socio.</p>
    </main>
  );

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-ink-2">
        <Link href="/portal" className="hover:text-brand">← Mi perfil</Link>
      </div>
      <h1 className="mb-1 text-2xl font-bold">Evolución de peso</h1>
      <p className="mb-6 text-ink-2">Cargá tu peso cada semana o cada mes y mirá cómo venís.</p>

      {/* Altura + resumen */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Peso inicial</div>
            <div className="mt-1 text-xl font-bold">{initial != null ? `${initial} kg` : "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Peso actual</div>
            <div className="mt-1 text-xl font-bold">{current != null ? `${current} kg` : "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Diferencia</div>
            <div className="mt-1 text-xl font-bold">
              {delta == null ? "—" : delta === 0 ? "Sin cambios" : `${delta > 0 ? "+" : ""}${delta} kg`}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-ink-2">Altura (cm)</label>
            <input className="input" type="number" step="0.1" placeholder="Ej: 172" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <button className="btn btn-ghost" onClick={saveHeight} disabled={savingHeight || !height}>
            {savingHeight ? "Guardando…" : "Guardar altura"}
          </button>
        </div>
      </div>

      {/* Gráfico */}
      {chart && (
        <div className="card mb-4">
          <div className="mb-2 text-sm font-semibold">Gráfico</div>
          <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="w-full" preserveAspectRatio="none">
            <path d={chart.path} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
            {chart.pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#22d3ee" />)}
          </svg>
        </div>
      )}

      {/* Cargar nuevo registro */}
      <div className="card mb-4">
        <div className="mb-3 text-sm font-semibold">Cargar peso</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-ink-2">Fecha</label>
            <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-2">Peso (kg)</label>
            <input className="input" type="number" step="0.1" placeholder="Ej: 78.5" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={addLog} disabled={saving || !newWeight}>
            {saving ? "Guardando…" : "Agregar"}
          </button>
        </div>
      </div>

      {/* Historial */}
      <div className="card p-0">
        <div className="border-b border-white/10 p-4 text-sm font-semibold">Historial</div>
        {logs.length === 0 ? (
          <p className="p-8 text-center text-ink-2">Todavía no cargaste ningún registro. Empezá con tu peso de hoy.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {logs.slice().reverse().map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-ink-2">{fdate(l.date)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{l.weight_kg} kg</span>
                  <button className="text-ink-2 hover:text-crit" title="Eliminar" onClick={() => removeLog(l.id)}>×</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
