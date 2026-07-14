"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface MemberLite { id: string; gym_id: string; }
interface RExercise {
  id: string; day_number: number; block_name: string | null; position: number;
  sets: string | null; reps: string | null; notes: string | null; exercises: { name: string } | null;
}
interface Routine { id: string; name: string | null; routine_exercises: RExercise[]; }
interface Session { id: string; day_number: number; date: string; completed_at: string | null }

export default function EntrenarPage() {
  const supabase = createClient();
  const [state, setState] = useState<"loading" | "nomember" | "noroutine" | "ok">("loading");
  const [member, setMember] = useState<MemberLite | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [dayNumber, setDayNumber] = useState<number | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/acceso"; return; }
    const { data: m } = await supabase
      .from("members").select("id, gym_id").eq("linked_user_id", user.id).maybeSingle<MemberLite>();
    if (!m) { setState("nomember"); return; }
    setMember(m);
    const { data: r } = await supabase
      .from("routines")
      .select("id, name, routine_exercises(id, day_number, block_name, position, sets, reps, notes, exercises(name))")
      .eq("member_id", m.id).order("created_at", { ascending: false }).limit(1).maybeSingle<Routine>();
    if (!r || r.routine_exercises.length === 0) { setState("noroutine"); return; }
    setRoutine(r);
    setState("ok");
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const days = useMemo(() => {
    if (!routine) return [];
    const nums = Array.from(new Set(routine.routine_exercises.map((r) => r.day_number))).sort((a, b) => a - b);
    return nums;
  }, [routine]);

  const dayBlocks = useMemo(() => {
    if (!routine || dayNumber == null) return [];
    const rows = routine.routine_exercises
      .filter((r) => r.day_number === dayNumber)
      .sort((a, b) => a.position - b.position);
    const blocks: { name: string; rows: RExercise[] }[] = [];
    const idx: Record<string, number> = {};
    rows.forEach((re) => {
      const bname = re.block_name || "Bloque 1";
      if (!(bname in idx)) { idx[bname] = blocks.length; blocks.push({ name: bname, rows: [] }); }
      blocks[idx[bname]].rows.push(re);
    });
    return blocks;
  }, [routine, dayNumber]);

  const allExerciseIds = useMemo(
    () => dayBlocks.flatMap((b) => b.rows.map((r) => r.id)),
    [dayBlocks]
  );

  async function startSession() {
    if (!member || !routine || dayNumber == null) return;
    setStarting(true);
    const { data, error } = await supabase.from("routine_sessions").insert({
      gym_id: member.gym_id, member_id: member.id, routine_id: routine.id,
      day_number: dayNumber, date: new Date().toISOString().slice(0, 10),
    }).select("id, day_number, date, completed_at").single<Session>();
    setStarting(false);
    if (!error && data) { setSession(data); setChecked(new Set()); }
  }

  async function toggleExercise(reId: string) {
    if (!session) return;
    const already = checked.has(reId);
    if (already) {
      await supabase.from("routine_session_checks").delete()
        .eq("session_id", session.id).eq("routine_exercise_id", reId);
      setChecked((s) => { const n = new Set(s); n.delete(reId); return n; });
    } else {
      await supabase.from("routine_session_checks").insert({ session_id: session.id, routine_exercise_id: reId });
      setChecked((s) => new Set(s).add(reId));
    }
  }

  async function finishSession() {
    if (!session) return;
    setFinishing(true);
    await supabase.from("routine_sessions").update({ completed_at: new Date().toISOString() }).eq("id", session.id);
    setFinishing(false);
    setSession((s) => (s ? { ...s, completed_at: new Date().toISOString() } : s));
  }

  function trainAgain() {
    setSession(null); setChecked(new Set()); setDayNumber(null);
  }

  if (state === "loading") return <main className="grid min-h-screen place-items-center text-ink-2">Cargando…</main>;
  if (state === "nomember") return (
    <main className="grid min-h-screen place-items-center px-6 text-center text-ink-2">No encontramos tu ficha de socio.</main>
  );
  if (state === "noroutine") return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
      <div className="mb-2 text-4xl">🏋️</div>
      <h1 className="text-xl font-bold">Todavía no tenés una rutina asignada</h1>
      <p className="mt-2 text-ink-2">Cuando tu gimnasio te cargue una rutina, vas a poder iniciarla acá.</p>
      <Link href="/portal" className="btn btn-primary mt-5 inline-block">← Volver a mi perfil</Link>
    </main>
  );

  const allDone = allExerciseIds.length > 0 && allExerciseIds.every((id) => checked.has(id));

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <div className="mb-6 flex items-center gap-2 text-sm text-ink-2">
        <Link href="/portal" className="hover:text-brand">← Mi perfil</Link>
      </div>
      <h1 className="mb-1 text-2xl font-bold">Iniciar rutina</h1>
      <p className="mb-6 text-ink-2">{routine?.name ? routine.name.split(" — ")[0] : "Tu rutina"}</p>

      {!session ? (
        <div className="card">
          <label className="mb-2 block text-sm font-semibold">Elegí el día que vas a entrenar hoy</label>
          <div className="mb-4 flex flex-wrap gap-2">
            {days.map((d) => (
              <button
                key={d}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${dayNumber === d ? "border-brand bg-[rgba(34,211,238,.12)] text-brand" : "border-white/10 bg-surface-2 text-ink-2"}`}
                onClick={() => setDayNumber(d)}
              >
                Día {d}
              </button>
            ))}
          </div>
          <button className="btn btn-primary w-full" disabled={dayNumber == null || starting} onClick={startSession}>
            {starting ? "Iniciando…" : "▶ Iniciar rutina"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Entrenando</div>
                <div className="text-lg font-bold">Día {session.day_number}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-brand">{checked.size}/{allExerciseIds.length}</div>
                <div className="text-xs text-muted">ejercicios</div>
              </div>
            </div>
          </div>

          {dayBlocks.map((block, bi) => (
            <div key={bi} className="card p-0">
              <div className="border-b border-white/10 p-3 text-sm font-semibold text-brand">{block.name}</div>
              <ul className="divide-y divide-white/5">
                {block.rows.map((re) => {
                  const done = checked.has(re.id);
                  return (
                    <li key={re.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className={`text-sm ${done ? "text-ink-2 line-through" : ""}`}>{re.exercises?.name || "Ejercicio"}</div>
                        <div className="text-xs text-muted">{re.sets || "-"} × {re.reps || "-"} {re.notes ? `· ${re.notes}` : ""}</div>
                      </div>
                      <button
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-base transition ${done ? "border-good bg-[rgba(34,197,94,.14)] text-good" : "border-white/15 text-ink-2 hover:text-ink"}`}
                        onClick={() => toggleExercise(re.id)}
                      >
                        ✓
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {session.completed_at ? (
            <div className="card text-center">
              <div className="mb-2 text-3xl">🎉</div>
              <div className="font-semibold">¡Rutina completada!</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button className="btn btn-ghost flex-1" onClick={trainAgain}>Entrenar otro día</button>
                <Link href="/portal/progreso" className="btn btn-primary flex-1 text-center">Ver mi progreso →</Link>
              </div>
            </div>
          ) : (
            <button className="btn btn-primary" disabled={finishing || !allDone} onClick={finishSession}>
              {finishing ? "Guardando…" : allDone ? "✓ Finalizar rutina" : `Marcá los ${allExerciseIds.length} ejercicios para finalizar`}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
