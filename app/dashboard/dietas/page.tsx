"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import AiChat from "@/components/AiChat";

interface Member { id: string; full_name: string; }
interface DMeal {
  id?: string; day_number: number; meal_type: string; position: number;
  title: string | null; detail: string | null; photo_url: string | null;
}
interface Diet {
  id: string; name: string | null; member_id: string | null;
  is_template: boolean; diet_meals: DMeal[];
}

interface EditDay { name: string; meals: DMeal[] }
interface EditDiet {
  id: string | null; name: string; member_id: string | null;
  is_template: boolean; days: EditDay[];
}

const MEAL_TYPES = ["Desayuno", "Colación", "Almuerzo", "Merienda", "Cena"];

const emptyMeal = (day: number, type: string, pos: number): DMeal => ({
  day_number: day, meal_type: type, position: pos, title: "", detail: "", photo_url: "",
});

const newDay = (dayNumber: number, label: string): EditDay => ({
  name: label,
  meals: MEAL_TYPES.map((t, i) => emptyMeal(dayNumber, t, i)),
});

const newDiet = (): EditDiet => ({
  id: null, name: "", member_id: null, is_template: true,
  days: [newDay(1, "Día 1")],
});

export default function DietasPage() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<EditDiet | null>(null);
  const [saving, setSaving] = useState(false);
  const [applyMember, setApplyMember] = useState("");
  const [applyMsg, setApplyMsg] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
    const gid = profile?.gym_id ?? null;
    setGymId(gid);
    if (gid) {
      const { data: sub } = await supabase
        .from("subscriptions").select("plan").eq("gym_id", gid).maybeSingle<{ plan: string }>();
      setPlan(sub?.plan ?? null);
    }
    const [{ data: mem }, { data: di }] = await Promise.all([
      supabase.from("members").select("id, full_name").order("full_name"),
      supabase.from("diets").select("*, diet_meals(*)").order("created_at", { ascending: false }),
    ]);
    setMembers((mem as Member[]) || []);
    setDiets((di as Diet[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function openDiet(d: Diet) {
    const byDay: Record<number, DMeal[]> = {};
    d.diet_meals.slice().sort((a, b) => a.day_number - b.day_number || a.position - b.position)
      .forEach((m) => { (byDay[m.day_number] ||= []).push(m); });
    const dayNums = Object.keys(byDay).map(Number).sort((a, b) => a - b);
    const days: EditDay[] = (dayNums.length ? dayNums : [1]).map((dn, i) => ({
      name: `Día ${i + 1}`,
      meals: (byDay[dn] && byDay[dn].length ? byDay[dn] : MEAL_TYPES.map((t, j) => emptyMeal(dn, t, j))).map((m) => ({ ...m })),
    }));
    setApplyMember(""); setApplyMsg("");
    setEdit({ id: d.id, name: d.name || "", member_id: d.member_id, is_template: d.is_template, days });
  }

  function startNew() { setApplyMember(""); setApplyMsg(""); setEdit(newDiet()); }

  function rowsFor(dietId: string) {
    return edit!.days.flatMap((d, di) =>
      d.meals.map((m, mi) => ({
        diet_id: dietId, day_number: di + 1, meal_type: m.meal_type, position: mi,
        title: m.title || null, detail: m.detail || null, photo_url: m.photo_url || null,
      }))
    ).filter((m) => m.title || m.detail || m.photo_url);
  }

  // Aplica la dieta/plantilla a un socio creando una COPIA independiente.
  async function applyToSocio() {
    if (!edit || !gymId || !applyMember) return;
    setSaving(true); setApplyMsg("");
    const memberName = members.find((m) => m.id === applyMember)?.full_name || "socio";
    const { data } = await supabase.from("diets").insert({
      gym_id: gymId,
      name: edit.name ? `${edit.name} — ${memberName}` : `Dieta de ${memberName}`,
      member_id: applyMember,
      is_template: false,
    }).select("id").single();
    const copyId = (data as { id: string } | null)?.id ?? null;
    if (copyId) {
      const rows = rowsFor(copyId);
      if (rows.length) await supabase.from("diet_meals").insert(rows);
    }
    setSaving(false);
    setApplyMsg(`Copia creada para ${memberName}. La plantilla quedó intacta.`);
    setApplyMember("");
    load();
  }

  const setName = (v: string) => setEdit((e) => (e ? { ...e, name: v } : e));
  const setMember = (v: string) => setEdit((e) => (e ? { ...e, member_id: v || null } : e));
  const addDay = () =>
    setEdit((e) => e ? { ...e, days: [...e.days, newDay(e.days.length + 1, `Día ${e.days.length + 1}`)] } : e);
  const removeDay = (di: number) =>
    setEdit((e) => e ? { ...e, days: e.days.filter((_, i) => i !== di) } : e);
  const addMeal = (di: number) =>
    setEdit((e) => e ? { ...e, days: e.days.map((d, i) => i === di ? { ...d, meals: [...d.meals, emptyMeal(di + 1, "Otra comida", d.meals.length)] } : d) } : e);
  const copyPreviousDay = (di: number) =>
    setEdit((e) => {
      if (!e || di === 0) return e;
      const prev = e.days[di - 1];
      return {
        ...e,
        days: e.days.map((d, i) => i === di
          ? { ...d, meals: prev.meals.map((m, j) => ({ ...m, id: undefined, day_number: di + 1, position: j })) }
          : d),
      };
    });
  const removeMeal = (di: number, mi: number) =>
    setEdit((e) => e ? { ...e, days: e.days.map((d, i) => i === di ? { ...d, meals: d.meals.filter((_, j) => j !== mi) } : d) } : e);
  const setMeal = (di: number, mi: number, k: keyof DMeal, v: string) =>
    setEdit((e) => e ? {
      ...e, days: e.days.map((d, i) => i === di ? {
        ...d, meals: d.meals.map((m, j) => j === mi ? { ...m, [k]: v } : m),
      } : d),
    } : e);

  async function saveDiet() {
    if (!edit || !gymId) return;
    setSaving(true);
    let dietId = edit.id;
    if (dietId) {
      await supabase.from("diets").update({ name: edit.name || "Dieta sin nombre" }).eq("id", dietId);
    } else {
      const { data } = await supabase.from("diets").insert({
        gym_id: gymId, name: edit.name || "Dieta sin nombre",
        member_id: edit.member_id || null, is_template: !edit.member_id,
      }).select("id").single();
      dietId = (data as { id: string } | null)?.id ?? null;
    }
    if (dietId) {
      await supabase.from("diet_meals").delete().eq("diet_id", dietId);
      const rows = rowsFor(dietId);
      if (rows.length) await supabase.from("diet_meals").insert(rows);
    }
    setSaving(false); setEdit(null); load();
  }

  async function deleteDiet(id: string) {
    if (!confirm("¿Eliminar esta dieta?")) return;
    await supabase.from("diets").delete().eq("id", id);
    setEdit(null); load();
  }

  const memberName = (id: string | null) => members.find((m) => m.id === id)?.full_name;

  if (!loading && plan !== "elite") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="mb-2 text-4xl">🥗</div>
        <h1 className="text-2xl font-bold">Dietas es una función Elite</h1>
        <p className="mt-2 text-ink-2">
          Armar dietas para tus socios (con plantillas y progreso) está disponible en el plan Elite de GymCore.
        </p>
        <Link href="/dashboard/mi-plan" className="btn btn-primary mt-5 inline-block">Ver planes</Link>
      </main>
    );
  }

  return (
    <main className="p-5 md:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link>
            <span>/</span><span>Dietas</span>
          </div>
          <h1 className="text-2xl font-bold">Dietas</h1>
          <p className="text-ink-2">{diets.length} dietas cargadas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AiChat kind="dieta" gymId={gymId} members={members} onDone={load} />
          <button className="btn btn-primary" onClick={startNew}>+ Nueva dieta</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="card p-0">
          <div className="border-b border-white/10 p-4 text-sm font-semibold">Tus dietas</div>
          {loading ? (
            <p className="p-6 text-center text-ink-2">Cargando…</p>
          ) : diets.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-2">Todavía no creaste dietas. Tocá “+ Nueva dieta”.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {diets.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => openDiet(d)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/[.03] ${edit?.id === d.id ? "bg-white/[.04]" : ""}`}
                  >
                    <div>
                      <div className="font-medium">{d.name || "Dieta sin nombre"}</div>
                      <div className="text-xs text-muted">
                        {d.member_id ? memberName(d.member_id) || "Socio" : "Plantilla"} · {d.diet_meals.length} comidas
                      </div>
                    </div>
                    <span className="text-ink-2">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!edit ? (
          <div className="card grid place-items-center py-16 text-center text-ink-2">
            <div>
              <div className="mb-2 text-4xl">🥗</div>
              Seleccioná una dieta o creá una nueva para empezar a armarla.
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-ink-2">Nombre de la dieta</label>
                <input className="input" placeholder="Ej: Déficit calórico 4 comidas" value={edit.name}
                  onChange={(e) => setName(e.target.value)} />
              </div>
              {edit.id === null ? (
                <div className="w-56">
                  <label className="mb-1 block text-xs text-ink-2">Tipo</label>
                  <select className="input" value={edit.member_id || ""} onChange={(e) => setMember(e.target.value)}>
                    <option value="">Plantilla (reutilizable)</option>
                    {members.map((m) => <option key={m.id} value={m.id}>Dieta de {m.full_name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="w-56">
                  <label className="mb-1 block text-xs text-ink-2">Tipo</label>
                  <div className="flex h-[42px] items-center rounded-lg border border-white/10 bg-surface-2 px-3 text-sm">
                    {edit.is_template
                      ? <span className="font-semibold text-brand">Plantilla reutilizable</span>
                      : <span className="text-ink-2">Dieta de {memberName(edit.member_id) || "socio"}</span>}
                  </div>
                </div>
              )}
            </div>

            {edit.id !== null && (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-sm font-semibold">
                  {edit.is_template ? "Aplicar esta plantilla a un socio" : "Duplicar para otro socio"}
                </div>
                <p className="mb-3 text-xs text-ink-2">
                  Se crea una copia editable para el socio. Los cambios en la copia no afectan {edit.is_template ? "la plantilla" : "esta dieta"}.
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
                    <span className="font-semibold">{day.name}</span>
                    <div className="ml-auto flex gap-2">
                      {di > 0 && (
                        <button className="text-xs text-ink-2 hover:text-brand" onClick={() => copyPreviousDay(di)}>
                          ⧉ Copiar día anterior
                        </button>
                      )}
                      <button className="text-xs text-ink-2 hover:text-brand" onClick={() => addMeal(di)}>+ Comida</button>
                      {edit.days.length > 1 && (
                        <button className="text-xs text-ink-2 hover:text-crit" onClick={() => removeDay(di)}>Quitar día</button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {day.meals.map((m, mi) => (
                      <div key={mi} className="grid grid-cols-[110px_1fr_1fr_1fr_28px] items-center gap-2">
                        <input className="input" value={m.meal_type}
                          onChange={(e) => setMeal(di, mi, "meal_type", e.target.value)} />
                        <input className="input" placeholder="Título (ej: Avena con fruta)" value={m.title || ""}
                          onChange={(e) => setMeal(di, mi, "title", e.target.value)} />
                        <input className="input" placeholder="Detalle / cantidades" value={m.detail || ""}
                          onChange={(e) => setMeal(di, mi, "detail", e.target.value)} />
                        <input className="input" placeholder="URL de foto (opcional)" value={m.photo_url || ""}
                          onChange={(e) => setMeal(di, mi, "photo_url", e.target.value)} />
                        <button className="grid h-8 w-7 place-items-center rounded-lg text-ink-2 hover:text-crit"
                          title="Quitar" onClick={() => removeMeal(di, mi)}>×</button>
                      </div>
                    ))}
                    {day.meals.length === 0 && (
                      <p className="text-xs text-muted">Sin comidas. Tocá “+ Comida”.</p>
                    )}
                  </div>
                </div>
              ))}
              <button className="text-sm text-brand hover:underline" onClick={addDay}>+ Agregar día</button>
            </div>

            <div className="mt-5 flex items-center justify-between">
              {edit.id ? (
                <button className="text-sm text-ink-2 hover:text-crit" onClick={() => deleteDiet(edit.id!)}>Eliminar dieta</button>
              ) : <span />}
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveDiet} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar dieta"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </main>
  );
}
