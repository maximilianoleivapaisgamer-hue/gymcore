"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import InstallAppButton from "@/components/InstallAppButton";

interface Member {
  id: string; gym_id: string; full_name: string; dni: string | null;
  plan_name: string | null; plan_price: number | null; membership_expiry: string | null;
  height_cm: number | null;
}
interface RExercise { day_number: number; block_name: string | null; position: number; sets: string | null; reps: string | null; notes: string | null; exercises: { name: string } | null; }
interface Routine { id: string; name: string | null; routine_exercises: RExercise[]; }
interface MyBooking { id: string; class_id: string; class_date: string; classes: { name: string; start_time: string | null; instructor: string | null } | null; }
interface Klass { id: string; name: string; instructor: string | null; weekdays: string[]; start_time: string | null; duration: number | null; capacity: number | null; color: string | null; }
interface BookingLite { id: string; class_id: string; member_id: string; class_date: string; }
interface WeightLog { date: string; weight_kg: number; }
interface DMeal { id: string; day_number: number; meal_type: string; position: number; title: string | null; detail: string | null; photo_url: string | null; }
interface Diet { id: string; name: string | null; diet_meals: DMeal[]; }
interface DietProgressRow { meal_id: string; date: string; }

const DAYS = [
  { code: "lun", label: "Lun", js: 1 }, { code: "mar", label: "Mar", js: 2 }, { code: "mie", label: "Mié", js: 3 },
  { code: "jue", label: "Jue", js: 4 }, { code: "vie", label: "Vie", js: 5 }, { code: "sab", label: "Sáb", js: 6 },
  { code: "dom", label: "Dom", js: 0 },
];

function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayIso() { return iso(new Date()); }
function nextOccurrence(weekdays: string[]): string | null {
  if (!weekdays || weekdays.length === 0) return null;
  const jsDays = weekdays.map((c) => DAYS.find((d) => d.code === c)?.js).filter((x) => x !== undefined) as number[];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    if (jsDays.includes(d.getDay())) return iso(d);
  }
  return null;
}
function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return Math.ceil((new Date(expiry + "T00:00:00").getTime() - Date.now()) / 86400000);
}
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "");
const BASE_TABS = [
  { key: "perfil", label: "Mi perfil" },
  { key: "rutina", label: "Rutina" },
  { key: "dieta", label: "Dieta" },
  { key: "clases", label: "Clases" },
] as const;
type TabKey = (typeof BASE_TABS)[number]["key"];
const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function PortalPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<TabKey>("perfil");
  const [state, setState] = useState<"loading" | "nomember" | "ok">("loading");
  const [member, setMember] = useState<Member | null>(null);
  const [gym, setGym] = useState<{ name: string; logo_url: string | null; whatsapp: string | null } | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [allBookings, setAllBookings] = useState<BookingLite[]>([]);
  const [lastWeight, setLastWeight] = useState<WeightLog | null>(null);
  const [busyClassKey, setBusyClassKey] = useState<string | null>(null);
  const [isElite, setIsElite] = useState(false);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [dietProgress, setDietProgress] = useState<DietProgressRow[]>([]);
  const [dietSub, setDietSub] = useState<"plan" | "progreso">("plan");
  const [busyMeal, setBusyMeal] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/acceso"; return; }
    const { data: m } = await supabase
      .from("members").select("id, gym_id, full_name, dni, plan_name, plan_price, membership_expiry, height_cm")
      .eq("linked_user_id", user.id).maybeSingle<Member>();
    if (!m) { setState("nomember"); return; }
    setMember(m);

    const iso0 = todayIso();
    const [{ data: g }, { data: r }, { data: mb }, { data: cl }, { data: ab }, { data: wl }, { data: sub }, { data: dt }] = await Promise.all([
      supabase.from("gyms").select("name, logo_url, whatsapp").eq("id", m.gym_id).maybeSingle<{ name: string; logo_url: string | null; whatsapp: string | null }>(),
      supabase.from("routines").select("id, name, routine_exercises(day_number, block_name, position, sets, reps, notes, exercises(name))")
        .eq("member_id", m.id).order("created_at", { ascending: false }).limit(1).maybeSingle<Routine>(),
      supabase.from("bookings").select("id, class_id, class_date, classes(name, start_time, instructor)")
        .eq("member_id", m.id).gte("class_date", iso0).order("class_date"),
      supabase.from("classes").select("*").order("start_time"),
      supabase.from("bookings").select("id, class_id, member_id, class_date").gte("class_date", iso0),
      supabase.from("weight_logs").select("date, weight_kg").eq("member_id", m.id).order("date", { ascending: false }).limit(1),
      supabase.from("subscriptions").select("plan").eq("gym_id", m.gym_id).maybeSingle<{ plan: string }>(),
      supabase.from("diets").select("id, name, diet_meals(id, day_number, meal_type, position, title, detail, photo_url)")
        .eq("member_id", m.id).order("created_at", { ascending: false }).limit(1).maybeSingle<Diet>(),
    ]);
    setGym(g ?? null);
    setRoutine((r as Routine) ?? null);
    setMyBookings((mb as MyBooking[]) || []);
    setClasses((cl as Klass[]) || []);
    setAllBookings((ab as BookingLite[]) || []);
    setLastWeight(((wl as WeightLog[]) || [])[0] ?? null);
    setIsElite(sub?.plan === "elite");
    setDiet((dt as Diet) ?? null);
    if (dt) {
      const { data: dp } = await supabase.from("diet_progress").select("meal_id, date")
        .eq("member_id", m.id).eq("diet_id", (dt as Diet).id);
      setDietProgress((dp as DietProgressRow[]) || []);
    }
    setState("ok");
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/acceso";
  }

  const days = useMemo(() => {
    if (!routine) return [];
    const by: Record<number, RExercise[]> = {};
    routine.routine_exercises
      .slice().sort((a, b) => a.day_number - b.day_number || a.position - b.position)
      .forEach((re) => { (by[re.day_number] ||= []).push(re); });
    return Object.keys(by).map(Number).sort((a, b) => a - b).map((d) => {
      const rows = by[d];
      const blocks: { name: string; rows: RExercise[] }[] = [];
      const idx: Record<string, number> = {};
      rows.forEach((re) => {
        const bname = re.block_name || "Bloque 1";
        if (!(bname in idx)) { idx[bname] = blocks.length; blocks.push({ name: bname, rows: [] }); }
        blocks[idx[bname]].rows.push(re);
      });
      return { label: `Día ${d}`, blocks };
    });
  }, [routine]);

  const dietDays = useMemo(() => {
    if (!diet) return [];
    const by: Record<number, DMeal[]> = {};
    diet.diet_meals.slice().sort((a, b) => a.day_number - b.day_number || a.position - b.position)
      .forEach((m) => { (by[m.day_number] ||= []).push(m); });
    return Object.keys(by).map(Number).sort((a, b) => a - b).map((d, i) => ({
      label: DAY_LABELS[i] || `Día ${d}`, meals: by[d],
    }));
  }, [diet]);

  const doneMealIds = useMemo(() => {
    const t = todayIso();
    return new Set(dietProgress.filter((p) => p.date === t).map((p) => p.meal_id));
  }, [dietProgress]);

  const dietAdherence = useMemo(() => {
    if (!diet || diet.diet_meals.length === 0) return null;
    const totalSlots = diet.diet_meals.length;
    const doneCount = new Set(dietProgress.map((p) => `${p.date}:${p.meal_id}`)).size;
    const daysTracked = new Set(dietProgress.map((p) => p.date)).size;
    return { totalSlots, doneCount, daysTracked };
  }, [diet, dietProgress]);

  async function toggleMeal(mealId: string) {
    if (!member || !diet) return;
    setBusyMeal(mealId);
    const t = todayIso();
    const already = doneMealIds.has(mealId);
    if (already) {
      await supabase.from("diet_progress").delete()
        .eq("member_id", member.id).eq("meal_id", mealId).eq("date", t);
      setDietProgress((ps) => ps.filter((p) => !(p.meal_id === mealId && p.date === t)));
    } else {
      await supabase.from("diet_progress").insert({ diet_id: diet.id, member_id: member.id, meal_id: mealId, date: t });
      setDietProgress((ps) => [...ps, { meal_id: mealId, date: t }]);
    }
    setBusyMeal(null);
  }

  async function reservar(c: Klass, date: string) {
    if (!member) return;
    setBusyClassKey(c.id + date);
    const { data, error } = await supabase.from("bookings")
      .insert({ gym_id: member.gym_id, class_id: c.id, member_id: member.id, class_date: date })
      .select("id, class_id, member_id, class_date").single<BookingLite>();
    if (!error && data) {
      setAllBookings((bs) => [...bs, data]);
      setMyBookings((mb) => [...mb, { id: data.id, class_id: c.id, class_date: date, classes: { name: c.name, start_time: c.start_time, instructor: c.instructor } }]);
    }
    setBusyClassKey(null);
  }
  async function cancelar(bookingId: string) {
    setBusyClassKey(bookingId);
    await supabase.from("bookings").delete().eq("id", bookingId);
    setAllBookings((bs) => bs.filter((b) => b.id !== bookingId));
    setMyBookings((mb) => mb.filter((b) => b.id !== bookingId));
    setBusyClassKey(null);
  }

  if (state === "loading") return <main className="grid min-h-screen place-items-center text-ink-2">Cargando…</main>;

  if (state === "nomember") return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-bold">No encontramos tu ficha</h1>
        <p className="mt-2 text-ink-2">
          Tu cuenta no está vinculada a ningún gimnasio todavía. Pedile a tu gimnasio que te cargue como socio
          con este mismo email, y volvé a entrar.
        </p>
        <button className="btn btn-ghost mt-4" onClick={logout}>Cerrar sesión</button>
      </div>
    </main>
  );

  const d = daysLeft(member!.membership_expiry);
  const memb = d === null
    ? { label: "Sin membresía activa", cls: "text-ink-2", chip: "bg-white/5 text-muted" }
    : d < 0 ? { label: `Venció hace ${Math.abs(d)} días`, cls: "text-crit", chip: "bg-[rgba(240,82,82,.14)] text-crit" }
    : d <= 7 ? { label: `Vence en ${d} días`, cls: "text-warn", chip: "bg-[rgba(245,177,61,.14)] text-warn" }
    : { label: "Activo", cls: "text-good", chip: "bg-[rgba(34,197,94,.14)] text-good" };

  const waHref = gym?.whatsapp
    ? `https://wa.me/${gym.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hola! Quiero abonar mi cuota${member!.plan_name ? ` del plan ${member!.plan_name}` : ""}.`
      )}`
    : null;

  const qrText = `SOCIO: ${member!.full_name} | DNI: ${member!.dni || "-"} | ${gym?.name || "GymCore"}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(qrText)}`;

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <div className="aurora" aria-hidden="true" />
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {gym?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gym.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-black font-black">
              {(gym?.name || "G").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-bold leading-tight">{gym?.name || "Mi gimnasio"}</div>
            <div className="text-xs text-muted">Hola, {member!.full_name.split(" ")[0]} 👋</div>
          </div>
        </div>
        <button className="text-sm text-ink-2 hover:text-crit" onClick={logout}>Salir</button>
      </header>

      {/* Tabs */}
      <div className={`mb-5 grid gap-1 rounded-xl border border-white/10 bg-surface-2 p-1 ${isElite ? "grid-cols-4" : "grid-cols-3"}`}>
        {BASE_TABS.filter((t) => t.key !== "dieta" || isElite).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${tab === t.key ? "bg-brand text-black" : "text-ink-2 hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "perfil" && (
        <div className="flex flex-col gap-4">
          {/* Card 1: estado de cuenta */}
          <div className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Estado de cuenta</div>
                <div className="mt-1 text-lg font-bold">{member!.plan_name || "Sin plan asignado"}</div>
                {member!.plan_price != null && <div className="text-sm text-ink-2">{money(member!.plan_price)} / mes</div>}
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${memb.chip}`}>{memb.label}</span>
            </div>
            {member!.membership_expiry && (
              <div className="mt-1 text-xs text-muted">
                Vence el {new Date(member!.membership_expiry + "T00:00:00").toLocaleDateString("es-AR")}
              </div>
            )}
            {waHref ? (
              <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-primary mt-4 w-full text-center">
                Pagar abono mensual
              </a>
            ) : (
              <button
                className="btn btn-primary mt-4 w-full"
                onClick={() => alert("Todavía no hay un medio de pago online conectado. Contactá a tu gimnasio para abonar.")}
              >
                Pagar abono mensual
              </button>
            )}
          </div>

          {/* Card 2: mis datos */}
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-muted">Mis datos</div>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted">Peso actual</div>
                <div className="text-xl font-bold">{lastWeight ? `${lastWeight.weight_kg} kg` : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Altura</div>
                <div className="text-xl font-bold">{member!.height_cm ? `${member!.height_cm} cm` : "—"}</div>
              </div>
            </div>
            <Link href="/portal/peso" className="btn btn-ghost mt-4 w-full text-center">
              {lastWeight ? "Ver evolución de peso →" : "Cargar mi peso inicial →"}
            </Link>
          </div>

          {/* Card 3: ver mi progreso (entrenamiento) */}
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-muted">Entrenamiento</div>
            <p className="mt-1 text-sm text-ink-2">Marcá los ejercicios a medida que los hacés y mirá cómo venís con el entrenamiento y la dieta.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href="/portal/entrenar" className="btn btn-primary flex-1 text-center">▶ Iniciar rutina</Link>
              <Link href="/portal/progreso" className="btn btn-ghost flex-1 text-center">Ver mi progreso →</Link>
            </div>
          </div>

          {/* Card 4: QR de acceso */}
          <div className="card text-center">
            <div className="mb-3 text-xs uppercase tracking-wide text-muted">Código QR de acceso</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Código QR de acceso" className="mx-auto h-[180px] w-[180px] rounded-lg border-4 border-brand bg-white p-1" />
            <div className="mt-2 text-xs text-muted">DNI: {member!.dni || "—"}</div>
            <div className="mt-1 text-xs text-ink-2">Presentá este código en recepción</div>
          </div>

          {/* Al final de "Mi perfil": recomendación de bajar la webapp */}
          <InstallAppButton />
        </div>
      )}

      {tab === "rutina" && (
        <div className="flex flex-col gap-4">
          {/* Tarjeta de entrenamiento arriba del detalle de la rutina */}
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-muted">Entrenamiento</div>
            <p className="mt-1 text-sm text-ink-2">Marcá los ejercicios a medida que los hacés y mirá tu progreso.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href="/portal/entrenar" className="btn btn-primary flex-1 text-center">▶ Iniciar rutina</Link>
              <Link href="/portal/progreso" className="btn btn-ghost flex-1 text-center">Ver mi progreso →</Link>
            </div>
          </div>

          <div className="card p-0">
          <div className="border-b border-white/10 p-4">
            <h2 className="font-semibold">Mi rutina{routine?.name ? ` · ${routine.name}` : ""}</h2>
          </div>
          {days.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-2">Tu gimnasio todavía no te asignó una rutina.</p>
          ) : (
            <div className="flex flex-col gap-5 p-4">
              {days.map((day, i) => (
                <div key={i}>
                  <div className="mb-2 text-sm font-semibold text-brand">{day.label}</div>
                  <div className="flex flex-col gap-3">
                    {day.blocks.map((block, bi) => (
                      <div key={bi} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        {(day.blocks.length > 1 || block.name !== "Bloque 1") && (
                          <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-ink-2">{block.name}</div>
                        )}
                        <div className="overflow-hidden rounded-lg border border-white/10">
                          {block.rows.map((re, j) => (
                            <div key={j} className="flex items-center justify-between border-b border-white/5 px-3 py-2 last:border-0">
                              <div>
                                <div className="text-sm">{re.exercises?.name || "Ejercicio"}</div>
                                {re.notes && <div className="text-xs text-muted">{re.notes}</div>}
                              </div>
                              <div className="text-sm text-ink-2">
                                {re.sets || "-"} × {re.reps || "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {tab === "dieta" && isElite && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-surface-2 p-1">
            <button onClick={() => setDietSub("plan")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${dietSub === "plan" ? "bg-brand text-black" : "text-ink-2 hover:text-ink"}`}>
              Tu Plan
            </button>
            <button onClick={() => setDietSub("progreso")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${dietSub === "progreso" ? "bg-brand text-black" : "text-ink-2 hover:text-ink"}`}>
              Tu progreso
            </button>
          </div>

          {!diet ? (
            <div className="card py-10 text-center text-sm text-ink-2">
              Tu gimnasio todavía no te asignó una dieta.
            </div>
          ) : dietSub === "plan" ? (
            <div className="card p-0">
              <div className="border-b border-white/10 p-4">
                <h2 className="font-semibold">{diet.name || "Tu dieta"}</h2>
              </div>
              <div className="flex flex-col gap-4 p-4">
                {dietDays.map((day, i) => (
                  <div key={i}>
                    <div className="mb-2 text-sm font-semibold text-brand">{day.label}</div>
                    <div className="space-y-2">
                      {day.meals.map((m) => (
                        <div key={m.id} className="flex items-center gap-3 rounded-lg border border-white/10 p-2">
                          {m.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                          ) : (
                            <div className="grid h-12 w-12 place-items-center rounded-lg bg-white/5 text-lg">🍽️</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs uppercase tracking-wide text-muted">{m.meal_type}</div>
                            <div className="truncate text-sm font-medium">{m.title || "—"}</div>
                            {m.detail && <div className="truncate text-xs text-ink-2">{m.detail}</div>}
                          </div>
                          <button
                            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm transition ${
                              doneMealIds.has(m.id) ? "border-good bg-[rgba(34,197,94,.14)] text-good" : "border-white/15 text-ink-2 hover:text-ink"
                            }`}
                            disabled={busyMeal === m.id}
                            title={doneMealIds.has(m.id) ? "Cumplida hoy" : "Marcar como cumplida hoy"}
                            onClick={() => toggleMeal(m.id)}
                          >
                            ✓
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-muted">Adherencia</div>
              {dietAdherence ? (
                <>
                  <div className="mt-2 text-3xl font-black">
                    {dietAdherence.doneCount}
                    <span className="text-base font-normal text-muted"> comidas cumplidas</span>
                  </div>
                  <div className="mt-1 text-sm text-ink-2">
                    Registraste progreso en {dietAdherence.daysTracked} día{dietAdherence.daysTracked === 1 ? "" : "s"}.
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-2">Todavía no marcaste ninguna comida como cumplida.</p>
              )}
              <p className="mt-4 text-xs text-muted">
                Marcá cada comida como cumplida desde “Tu Plan” a medida que la vas haciendo, para ver acá tu evolución día a día.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "clases" && (
        <div className="flex flex-col gap-4">
          <div className="card p-0">
            <div className="border-b border-white/10 p-4">
              <h2 className="font-semibold">Mis próximas clases</h2>
            </div>
            {myBookings.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-2">No tenés clases reservadas.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {myBookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{b.classes?.name || "Clase"}</div>
                      {b.classes?.instructor && <div className="text-xs text-muted">{b.classes.instructor}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm text-ink-2">
                        <div>{new Date(b.class_date + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}</div>
                        {b.classes?.start_time && <div className="text-xs text-muted">{fmtTime(b.classes.start_time)}</div>}
                      </div>
                      <button
                        className="text-xs text-ink-2 hover:text-crit"
                        disabled={busyClassKey === b.id}
                        onClick={() => cancelar(b.id)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-0">
            <div className="border-b border-white/10 p-4">
              <h2 className="font-semibold">Todas las clases</h2>
              <p className="text-xs text-muted">Tocá "Reservar" para anotarte a la próxima fecha.</p>
            </div>
            {classes.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-2">Tu gimnasio todavía no cargó clases.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {classes.map((c) => {
                  const date = nextOccurrence(c.weekdays);
                  if (!date) return null;
                  const occupied = allBookings.filter((b) => b.class_id === c.id && b.class_date === date).length;
                  const mine = allBookings.find((b) => b.class_id === c.id && b.class_date === date && b.member_id === member!.id);
                  const full = c.capacity != null && occupied >= c.capacity;
                  const key = c.id + date;
                  return (
                    <li key={key} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color || "#22d3ee" }} />
                        <div>
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-xs text-muted">
                            {new Date(date + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}
                            {c.start_time ? ` · ${fmtTime(c.start_time)}` : ""}
                            {c.instructor ? ` · ${c.instructor}` : ""}
                          </div>
                          <div className="text-xs text-muted">{occupied}{c.capacity != null ? ` / ${c.capacity}` : ""} anotados</div>
                        </div>
                      </div>
                      {mine ? (
                        <button className="btn btn-ghost text-xs" disabled={busyClassKey === mine.id} onClick={() => cancelar(mine.id)}>
                          Cancelar
                        </button>
                      ) : (
                        <button className="btn btn-primary text-xs" disabled={full || busyClassKey === key} onClick={() => reservar(c, date)}>
                          {full ? "Cupo lleno" : "Reservar"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">GymCore · <Link href="/acceso" className="hover:text-brand">Cerrar sesión</Link></p>
    </main>
  );
}
