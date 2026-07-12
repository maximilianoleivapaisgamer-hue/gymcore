"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface Exercise { id: string; name: string; notes: string | null; }
interface Member { id: string; full_name: string; }
interface RExercise {
  id?: string; exercise_id: string | null; day_number: number;
  block_name: string | null; position: number; sets: string | null;
  reps: string | null; notes: string | null;
}
interface Routine {
  id: string; name: string | null; member_id: string | null;
  is_template: boolean; routine_exercises: RExercise[];
}

interface EditDay { name: string; rows: RExercise[] }
interface EditRoutine {
  id: string | null; name: string; member_id: string | null;
  is_template: boolean; days: EditDay[];
}

const emptyRow = (day: number, pos: number): RExercise => ({
  exercise_id: null, day_number: day, block_name: null, position: pos,
  sets: "", reps: "", notes: "",
});

const newRoutine = (): EditRoutine => ({
  id: null, name: "", member_id: null, is_template: true,
  days: [{ name: "Día 1", rows: [emptyRow(1, 0)] }],
});

export default function RutinasPage() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<EditRoutine | null>(null);
  const [saving, setSaving] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [newEx, setNewEx] = useState("");
  const [applyMember, setApplyMember] = useState("");
  const [applyMsg, setApplyMsg] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
    setGymId(profile?.gym_id ?? null);
    const [{ data: ex }, { data: mem }, { data: rout }] = await Promise.all([
      supabase.from("exercises").select("id, name, notes").order("name"),
      supabase.from("members").select("id, full_name").order("full_name"),
      supabase.from("routines").select("*, routine_exercises(*)").order("created_at", { ascending: false }),
    ]);
    setExercises((ex as Exercise[]) || []);
    setMembers((mem as Member[]) || []);
    setRoutines((rout as Routine[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const exMap = useMemo(() => {
    const m: Record<string, string> = {};
    exercises.forEach((e) => (m[e.id] = e.name));
    return m;
  }, [exercises]);

  function openRoutine(r: Routine) {
    const byDay: Record<number, RExercise[]> = {};
    r.routine_exercises
      .slice()
      .sort((a, b) => a.day_number - b.day_number || a.position - b.position)
      .forEach((re) => { (byDay[re.day_number] ||= []).push(re); });
    const dayNums = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    const days: EditDay[] = (dayNums.length ? dayNums : [1]).map((d, i) => ({
      name: byDay[d]?.[0]?.block_name || `Día ${i + 1}`,
      rows: (byDay[d] || [emptyRow(i + 1, 0)]).map((row) => ({ ...row })),
    }));
    setApplyMember(""); setApplyMsg("");
    setEdit({ id: r.id, name: r.name || "", member_id: r.member_id, is_template: r.is_template, days });
  }

  function startNew() { setApplyMember(""); setApplyMsg(""); setEdit(newRoutine()); }

  // Convierte los días del editor en filas de routine_exercises para un routine_id.
  function rowsFor(routineId: string) {
    return edit!.days.flatMap((d, di) =>
      d.rows.map((r, pi) => ({
        routine_id: routineId, exercise_id: r.exercise_id || null,
        day_number: di + 1, block_name: d.name || null, position: pi,
        sets: r.sets || null, reps: r.reps || null, notes: r.notes || null,
      }))
    ).filter((r) => r.exercise_id);
  }

  // Aplica la rutina/plantilla a un socio creando una COPIA independiente.
  // La plantilla original queda intacta.
  async function applyToSocio() {
    if (!edit || !gymId || !applyMember) return;
    setSaving(true);
    setApplyMsg("");
    const memberName = members.find((m) => m.id === applyMember)?.full_name || "socio";
    const { data } = await supabase.from("routines").insert({
      gym_id: gymId,
      name: edit.name ? `${edit.name} — ${memberName}` : `Rutina de ${memberName}`,
      member_id: applyMember,
      is_template: false,
    }).select("id").single();
    const copyId = (data as { id: string } | null)?.id ?? null;
    if (copyId) {
      const rows = rowsFor(copyId);
      if (rows.length) await supabase.from("routine_exercises").insert(rows);
    }
    setSaving(false);
    setApplyMsg(`Copia creada para ${memberName}. La plantilla quedó intacta.`);
    setApplyMember("");
    load();
  }

  async function addExercise() {
    const name = newEx.trim();
    if (!name || !gymId) return;
    const { data } = await supabase.from("exercises")
      .insert({ gym_id: gymId, name }).select("id, name, notes").single();
    if (data) setExercises((xs) => [...xs, data as Exercise].sort((a, b) => a.name.localeCompare(b.name)));
    setNewEx("");
  }

  async function removeExercise(id: string) {
    if (!confirm("¿Eliminar este ejercicio de la biblioteca?")) return;
    await supabase.from("exercises").delete().eq("id", id);
    setExercises((xs) => xs.filter((x) => x.id !== id));
  }

  // ---- editor helpers ----
  const setName = (v: string) => setEdit((e) => (e ? { ...e, name: v } : e));
  const setMember = (v: string) => setEdit((e) => (e ? { ...e, member_id: v || null } : e));
  const setDayName = (di: number, v: string) =>
    setEdit((e) => e ? { ...e, days: e.days.map((d, i) => i === di ? { ...d, name: v } : d) } : e);
  const addDay = () =>
    setEdit((e) => e ? { ...e, days: [...e.days, { name: `Día ${e.days.length + 1}`, rows: [emptyRow(e.days.length + 1, 0)] }] } : e);
  const removeDay = (di: number) =>
    setEdit((e) => e ? { ...e, days: e.days.filter((_, i) => i !== di) } : e);
  const addRow = (di: number) =>
    setEdit((e) => e ? { ...e, days: e.days.map((d, i) => i === di ? { ...d, rows: [...d.rows, emptyRow(di + 1, d.rows.length)] } : d) } : e);
  const removeRow = (di: number, ri: number) =>
    setEdit((e) => e ? { ...e, days: e.days.map((d, i) => i === di ? { ...d, rows: d.rows.filter((_, j) => j !== ri) } : d) } : e);
  const setRow = (di: number, ri: number, k: keyof RExercise, v: string) =>
    setEdit((e) => e ? {
      ...e, days: e.days.map((d, i) => i === di ? {
        ...d, rows: d.rows.map((r, j) => j === ri ? { ...r, [k]: v } : r),
      } : d),
    } : e);

  async function saveRoutine() {
    if (!edit || !gymId) return;
    setSaving(true);
    let routineId = edit.id;
    if (routineId) {
      // Editar en el lugar: preserva su naturaleza (plantilla o de socio).
      // Nunca reconvierte una plantilla en la rutina de un cliente.
      await supabase.from("routines")
        .update({ name: edit.name || "Rutina sin nombre" })
        .eq("id", routineId);
    } else {
      // Nueva: si elegís un socio queda como su rutina; si no, es plantilla.
      const { data } = await supabase.from("routines").insert({
        gym_id: gymId,
        name: edit.name || "Rutina sin nombre",
        member_id: edit.member_id || null,
        is_template: !edit.member_id,
      }).select("id").single();
      routineId = (data as { id: string } | null)?.id ?? null;
    }
    if (routineId) {
      await supabase.from("routine_exercises").delete().eq("routine_id", routineId);
      const rows = rowsFor(routineId);
      if (rows.length) await supabase.from("routine_exercises").insert(rows);
    }
    setSaving(false); setEdit(null); load();
  }

  async function deleteRoutine(id: string) {
    if (!confirm("¿Eliminar esta rutina?")) return;
    await supabase.from("routines").delete().eq("id", id);
    setEdit(null); load();
  }

  const memberName = (id: string | null) => members.find((m) => m.id === id)?.full_name;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link>
            <span>/</span><span>Rutinas</span>
          </div>
          <h1 className="text-2xl font-bold">Rutinas</h1>
          <p className="text-ink-2">{routines.length} rutinas · {exercises.length} ejercicios en biblioteca</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setLibOpen(true)}>Biblioteca</button>
          <button className="btn btn-primary" onClick={startNew}>+ Nueva rutina</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Lista de rutinas */}
        <div className="card p-0">
          <div className="border-b border-white/10 p-4 text-sm font-semibold">Tus rutinas</div>
          {loading ? (
            <p className="p-6 text-center text-ink-2">Cargando…</p>
          ) : routines.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-2">Todavía no creaste rutinas. Tocá “+ Nueva rutina”.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {routines.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => openRoutine(r)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[.03] ${edit?.id === r.id ? "bg-white/[.04]" : ""}`}
                  >
                    <div>
                      <div className="font-medium">{r.name || "Rutina sin nombre"}</div>
                      <div className="text-xs text-muted">
                        {r.member_id ? memberName(r.member_id) || "Socio" : "Plantilla"} · {r.routine_exercises.length} ejercicios
                      </div>
                    </div>
                    <span className="text-ink-2">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        {!edit ? (
          <div className="card grid place-items-center py-16 text-center text-ink-2">
            <div>
              <div className="mb-2 text-4xl">◈</div>
              Seleccioná una rutina o creá una nueva para empezar a armarla.
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-ink-2">Nombre de la rutina</label>
                <input className="input" placeholder="Ej: Hipertrofia 4 días" value={edit.name}
                  onChange={(e) => setName(e.target.value)} />
              </div>
              {edit.id === null ? (
                <div className="w-56">
                  <label className="mb-1 block text-xs text-ink-2">Tipo</label>
                  <select className="input" value={edit.member_id || ""} onChange={(e) => setMember(e.target.value)}>
                    <option value="">Plantilla (reutilizable)</option>
                    {members.map((m) => <option key={m.id} value={m.id}>Rutina de {m.full_name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="w-56">
                  <label className="mb-1 block text-xs text-ink-2">Tipo</label>
                  <div className="flex h-[42px] items-center rounded-lg border border-white/10 bg-surface-2 px-3 text-sm">
                    {edit.is_template
                      ? <span className="font-semibold text-brand">Plantilla reutilizable</span>
                      : <span className="text-ink-2">Rutina de {memberName(edit.member_id) || "socio"}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Aplicar a socio: crea una COPIA independiente (la plantilla queda intacta) */}
            {edit.id !== null && (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-sm font-semibold">
                  {edit.is_template ? "Aplicar esta plantilla a un socio" : "Duplicar para otro socio"}
                </div>
                <p className="mb-3 text-xs text-ink-2">
                  Se crea una copia editable para el socio. Los cambios en la copia no afectan {edit.is_template ? "la plantilla" : "esta rutina"}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <select className="input max-w-[220px]" value={applyMember} onChange={(e) => setApplyMember(e.target.value)}>
                    <option value="">— Elegí un socio —</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={applyToSocio} disabled={!applyMember || saving}>
                    Aplicar (crear copia)
                  </button>
                </div>
                {applyMsg && <p className="mt-2 text-xs text-good">{applyMsg}</p>}
              </div>
            )}

            <div className="space-y-4">
              {edit.days.map((day, di) => (
                <div key={di} className="rounded-xl border border-white/10 bg-surface-2 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <input className="input max-w-[200px] font-semibold" value={day.name}
                      onChange={(e) => setDayName(di, e.target.value)} />
                    <div className="ml-auto flex gap-2">
                      <button className="text-xs text-ink-2 hover:text-brand" onClick={() => addRow(di)}>+ Ejercicio</button>
                      {edit.days.length > 1 && (
                        <button className="text-xs text-ink-2 hover:text-crit" onClick={() => removeDay(di)}>Quitar día</button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {day.rows.map((row, ri) => (
                      <div key={ri} className="grid grid-cols-[1fr_70px_70px_1fr_28px] items-center gap-2">
                        <select className="input" value={row.exercise_id || ""}
                          onChange={(e) => setRow(di, ri, "exercise_id", e.target.value)}>
                          <option value="">— Ejercicio —</option>
                          {exercises.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                        <input className="input" placeholder="Series" value={row.sets || ""}
                          onChange={(e) => setRow(di, ri, "sets", e.target.value)} />
                        <input className="input" placeholder="Reps" value={row.reps || ""}
                          onChange={(e) => setRow(di, ri, "reps", e.target.value)} />
                        <input className="input" placeholder="Nota (opcional)" value={row.notes || ""}
                          onChange={(e) => setRow(di, ri, "notes", e.target.value)} />
                        <button className="grid h-8 w-7 place-items-center rounded-lg text-ink-2 hover:text-crit"
                          title="Quitar" onClick={() => removeRow(di, ri)}>×</button>
                      </div>
                    ))}
                    {day.rows.length === 0 && (
                      <p className="text-xs text-muted">Sin ejercicios. Tocá “+ Ejercicio”.</p>
                    )}
                  </div>
                </div>
              ))}
              <button className="text-sm text-brand hover:underline" onClick={addDay}>+ Agregar día</button>
            </div>

            {exercises.length === 0 && (
              <p className="mt-3 rounded-lg bg-white/5 p-3 text-xs text-ink-2">
                Tu biblioteca está vacía. Abrí “Biblioteca” y cargá algunos ejercicios para poder elegirlos acá.
              </p>
            )}

            <div className="mt-5 flex items-center justify-between">
              {edit.id ? (
                <button className="text-sm text-ink-2 hover:text-crit" onClick={() => deleteRoutine(edit.id!)}>Eliminar rutina</button>
              ) : <span />}
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveRoutine} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar rutina"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal biblioteca de ejercicios */}
      {libOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setLibOpen(false)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold">Biblioteca de ejercicios</h3>
            <p className="mb-4 text-sm text-ink-2">Los ejercicios que cargues acá aparecen al armar tus rutinas.</p>
            <div className="mb-4 flex gap-2">
              <input className="input" placeholder="Nombre del ejercicio (ej: Press banca)" value={newEx}
                onChange={(e) => setNewEx(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addExercise(); }} />
              <button className="btn btn-primary" onClick={addExercise} disabled={!newEx.trim()}>Agregar</button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {exercises.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-2">Todavía no hay ejercicios.</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {exercises.map((x) => (
                    <li key={x.id} className="flex items-center justify-between py-2">
                      <span className="text-sm">{x.name}</span>
                      <button className="text-ink-2 hover:text-crit" title="Eliminar" onClick={() => removeExercise(x.id)}>🗑️</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn btn-ghost" onClick={() => setLibOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
