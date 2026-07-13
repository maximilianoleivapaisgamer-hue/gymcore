"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface MemberLite { id: string; gym_id: string; height_cm: number | null; }
interface WeightLog { date: string; weight_kg: number; }
interface SessionRow {
  id: string; routine_id: string; day_number: number; date: string; completed_at: string | null;
  routines: { name: string | null } | null;
  routine_session_checks: { count: number }[];
}
interface RExerciseLite { routine_id: string; day_number: number; }

function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=domingo
  const diff = day === 0 ? -6 : 1 - day; // arranca lunes
  const s = new Date(d);
  s.setDate(d.getDate() + diff);
  s.setHours(0, 0, 0, 0);
  return s;
}

export default function ProgresoPage() {
  const supabase = createClient();
  const [state, setState] = useState<"loading" | "nomember" | "ok">("loading");
  const [member, setMember] = useState<MemberLite | null>(null);
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [totalsByRoutineDay, setTotalsByRoutineDay] = useState<Record<string, number>>({});

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/acceso"; return; }
    const { data: m } = await supabase
      .from("members").select("id, gym_id, height_cm").eq("linked_user_id", user.id).maybeSingle<MemberLite>();
    if (!m) { setState("nomember"); return; }
    setMember(m);

    const [{ data: wl }, { data: sess }] = await Promise.all([
      supabase.from("weight_logs").select("date, weight_kg").eq("member_id", m.id).order("date", { ascending: true }),
      supabase.from("routine_sessions")
        .select("id, routine_id, day_number, date, completed_at, routines(name), routine_session_checks(count)")
        .eq("member_id", m.id).order("date", { ascending: false }).limit(60),
    ]);
    setLogs((wl as WeightLog[]) || []);
    const sessionRows = (sess as unknown as SessionRow[]) || [];
    setSessions(sessionRows);

    const routineIds = Array.from(new Set(sessionRows.map((s) => s.routine_id)));
    if (routineIds.length) {
      const { data: rex } = await supabase.from("routine_exercises")
        .select("routine_id, day_number").in("routine_id", routineIds);
      const totals: Record<string, number> = {};
      ((rex as RExerciseLite[]) || []).forEach((r) => {
        const k = `${r.routine_id}:${r.day_number}`;
        totals[k] = (totals[k] || 0) + 1;
      });
      setTotalsByRoutineDay(totals);
    }
    setState("ok");
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const thisWeekCount = useMemo(() => {
    const start = startOfWeek(new Date());
    return sessions.filter((s) => new Date(s.date + "T00:00:00") >= start).length;
  }, [sessions]);

  const last8Weeks = useMemo(() => {
    const weeks: { label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ref = new Date();
      ref.setDate(ref.getDate() - i * 7);
      const s = startOfWeek(ref);
      const e = new Date(s); e.setDate(s.getDate() + 7);
      const count = sessions.filter((x) => {
        const d = new Date(x.date + "T00:00:00");
        return d >= s && d < e;
      }).length;
      weeks.push({ label: `${pad(s.getDate())}/${pad(s.getMonth() + 1)}`, count });
    }
    return weeks;
  }, [sessions]);

  const current = logs[logs.length - 1]?.weight_kg;
  const initial = logs[0]?.weight_kg;
  const maxWeekCount = Math.max(1, ...last8Weeks.map((w) => w.count));

  if (state === "loading") return <main className="grid min-h-screen place-items-center text-ink-2">Cargando…</main>;
  if (state === "nomember") return (
    <main className="grid min-h-screen place-items-center px-6 text-center text-ink-2">No encontramos tu ficha de socio.</main>
  );

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-ink-2">
        <Link href="/portal" className="hover:text-brand">← Mi perfil</Link>
      </div>
      <h1 className="mb-1 text-2xl font-bold">Mi progreso</h1>
      <p className="mb-6 text-ink-2">Así venís esta semana y en el tiempo.</p>

      {/* Arriba de todo: asistencia semanal */}
      <div className="card mb-4">
        <div className="text-xs uppercase tracking-wide text-muted">Asistencia esta semana</div>
        <div className="mt-1 text-3xl font-black text-brand">{thisWeekCount} <span className="text-base font-normal text-ink-2">veces</span></div>
        <div className="mt-4 flex items-end gap-2" style={{ height: 60 }}>
          {last8Weeks.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-brand/70"
                style={{ height: `${Math.max(4, (w.count / maxWeekCount) * 48)}px` }}
                title={`${w.count} veces`}
              />
              <span className="text-[10px] text-muted">{w.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Peso actual */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Peso actual</div>
            <div className="mt-1 text-xl font-bold">{current != null ? `${current} kg` : "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Altura</div>
            <div className="mt-1 text-xl font-bold">{member?.height_cm ? `${member.height_cm} cm` : "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Desde el inicio</div>
            <div className="mt-1 text-xl font-bold">
              {initial != null && current != null ? `${current - initial > 0 ? "+" : ""}${Math.round((current - initial) * 10) / 10} kg` : "—"}
            </div>
          </div>
        </div>
        <Link href="/portal/peso" className="btn btn-ghost mt-4 w-full text-center">Ver evolución de peso →</Link>
      </div>

      {/* Historial de rutinas */}
      <div className="card p-0">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <span className="text-sm font-semibold">Rutinas realizadas</span>
          <Link href="/portal/entrenar" className="text-sm text-brand hover:underline">+ Iniciar rutina</Link>
        </div>
        {sessions.length === 0 ? (
          <p className="p-8 text-center text-ink-2">Todavía no iniciaste ninguna rutina. Tocá &quot;Iniciar rutina&quot; para empezar a registrar tu progreso.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {sessions.map((s) => {
              const total = totalsByRoutineDay[`${s.routine_id}:${s.day_number}`] || 0;
              const done = s.routine_session_checks?.[0]?.count || 0;
              const complete = !!s.completed_at || (total > 0 && done >= total);
              return (
                <li key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{s.routines?.name || "Rutina"} · Día {s.day_number}</div>
                    <div className="text-xs text-muted">{new Date(s.date + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}</div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${complete ? "bg-[rgba(34,197,94,.14)] text-good" : "bg-[rgba(245,177,61,.14)] text-warn"}`}>
                      {complete ? "Completada" : `${done}/${total || "?"}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
