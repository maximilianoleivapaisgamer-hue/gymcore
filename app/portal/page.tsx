"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { allows, loadPlans, loadGymExtras } from "@/lib/plans";
import { cicloDe, topeDelPlan, claseIncluida, planDelSocio } from "@/lib/cupo-clases";
import { lunesDe, sumarDias, fechaDeDia, rangoSemana, fechaLarga, inicialDe } from "@/lib/clases";
import type { RealPlan } from "@/types/db";
import InstallAppButton from "@/components/InstallAppButton";
import ThemeApply from "@/components/ThemeApply";
import DemoVisitPing from "@/components/DemoVisitPing";
import AppBackground from "@/components/AppBackground";

interface Member {
  id: string; gym_id: string; full_name: string; dni: string | null;
  plan_name: string | null; plan_price: number | null; membership_expiry: string | null;
  height_cm: number | null;
  /** Cupos extra por clases sueltas que le vendieron. */
  clases_extra?: number | null;
}
interface ExerciseInfo { name: string; image_url: string | null; image_url_end: string | null; instructions: string[] | null; primary_muscles: string[] | null; equipment: string | null; }
interface RExercise { id: string; day_number: number; block_name: string | null; position: number; sets: string | null; reps: string | null; notes: string | null; exercises: ExerciseInfo | null; }
interface Routine { id: string; name: string | null; routine_exercises: RExercise[]; }
interface MyBooking { id: string; class_id: string; class_date: string; classes: { name: string; start_time: string | null; instructor: string | null } | null; }
interface Klass { id: string; sede_id: string | null; name: string; instructor: string | null; weekdays: string[]; start_time: string | null; duration: number | null; capacity: number | null; color: string | null; image_url: string | null; }
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
function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return Math.ceil((new Date(expiry + "T00:00:00").getTime() - Date.now()) / 86400000);
}
const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "");
function minutosDe(t: string | null): number {
  const [h, m] = fmtTime(t).split(":");
  return Number(h || 0) * 60 + Number(m || 0);
}

/** Cuándo arranca una clase, como fecha real. Sin horario, a las 00:00. */
function arranqueDe(fecha: string, hora: string | null): Date {
  const d = new Date(fecha + "T00:00:00");
  d.setMinutes(minutosDe(hora));
  return d;
}
/**
 * Cuantas semanas puede reservar el socio, contando la actual.
 *
 * Lo elige cada negocio en Configuracion -> Reservas de clases
 * (gyms.reserva_semanas). Este es el valor por si el gimnasio todavia no lo
 * guardo: esta semana y las dos siguientes.
 */
const RESERVA_SEMANAS_DEFECTO = 3;

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
  const [gym, setGym] = useState<{ name: string; logo_url: string | null; whatsapp: string | null; theme: string; bg_style: string; is_demo?: boolean; slug?: string; hidden_member_sections?: string[] | null; cancelacion_activa?: boolean; cancelacion_horas?: number | null; reserva_semanas?: number | null; reserva_hasta_vencimiento?: boolean } | null>(null);
  /** Cupo de clases del plan del socio. null = plan sin tope. */
  const [cupo, setCupo] = useState<{ limite: number; usadas: number } | null>(null);
  /** El plan del socio, para saber qué actividades tiene incluidas. */
  const [miPlan, setMiPlan] = useState<RealPlan | null>(null);
  /** Motivo por el que no se pudo reservar (lo tira el trigger de la base). */
  const [reservaErr, setReservaErr] = useState("");
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [openDemo, setOpenDemo] = useState<Set<string>>(new Set());
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [allBookings, setAllBookings] = useState<BookingLite[]>([]);
  /** Dia de la semana que esta mirando el socio en la grilla ("lun", "mar"...). */
  const [diaSel, setDiaSel] = useState<string | null>(null);
  /** 0 = esta semana, 1 = la que viene, y asi. */
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [lastWeight, setLastWeight] = useState<WeightLog | null>(null);
  const [busyClassKey, setBusyClassKey] = useState<string | null>(null);
  const [isElite, setIsElite] = useState(false);
  const [diet, setDiet] = useState<Diet | null>(null);
  const [dietProgress, setDietProgress] = useState<DietProgressRow[]>([]);
  const [dietSub, setDietSub] = useState<"plan" | "progreso">("plan");
  const [busyMeal, setBusyMeal] = useState<string | null>(null);
  const [rutDayIdx, setRutDayIdx] = useState(0);
  const [dietDayIdx, setDietDayIdx] = useState(0);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/acceso"; return; }
    const { data: m } = await supabase
      .from("members").select("id, gym_id, full_name, dni, plan_name, plan_price, membership_expiry, height_cm, clases_extra")
      .eq("linked_user_id", user.id).maybeSingle<Member>();
    if (!m) { setState("nomember"); return; }
    setMember(m);

    const iso0 = todayIso();
    const [{ data: g }, { data: r }, { data: mb }, { data: cl }, { data: ab }, { data: wl }, { data: sub }, { data: dt }] = await Promise.all([
      supabase.from("gyms").select("*").eq("id", m.gym_id).maybeSingle<{ name: string; logo_url: string | null; whatsapp: string | null; theme: string; bg_style: string; is_demo: boolean; slug: string; hidden_member_sections: string[] | null; real_plans: RealPlan[] | null; cancelacion_activa: boolean; cancelacion_horas: number | null; reserva_semanas: number | null; reserva_hasta_vencimiento: boolean }>(),
      supabase.from("routines").select("id, name, routine_exercises(id, day_number, block_name, position, sets, reps, notes, exercises(name, image_url, image_url_end, instructions, primary_muscles, equipment))")
        .eq("member_id", m.id).order("created_at", { ascending: false }).limit(1).maybeSingle<Routine>(),
      supabase.from("bookings").select("id, class_id, class_date, classes(name, start_time, instructor)")
        .eq("member_id", m.id).gte("class_date", iso0).order("class_date"),
      // SIEMPRE filtrar por gym_id. RLS es la red de seguridad, no el único
      // control: cuando se abrió la lectura de classes para la web pública,
      // esta consulta empezó a traer las clases de TODOS los gimnasios y los
      // socios de DanzArte vieron clases que no existían en su estudio.
      supabase.from("classes").select("*").eq("gym_id", m.gym_id).order("start_time"),
      supabase.from("bookings").select("id, class_id, member_id, class_date").eq("gym_id", m.gym_id).gte("class_date", iso0),
      supabase.from("weight_logs").select("date, weight_kg").eq("member_id", m.id).order("date", { ascending: false }).limit(1),
      supabase.from("subscriptions").select("plan").eq("gym_id", m.gym_id).maybeSingle<{ plan: string }>(),
      supabase.from("diets").select("id, name, diet_meals(id, day_number, meal_type, position, title, detail, photo_url)")
        .eq("member_id", m.id).order("created_at", { ascending: false }).limit(1).maybeSingle<Diet>(),
    ]);
    setGym(g ?? null);
    await recalcularCupo(m, g?.real_plans ?? null);
    setRoutine((r as Routine) ?? null);
    setMyBookings((mb as MyBooking[]) || []);
    setClasses((cl as Klass[]) || []);
    setAllBookings((ab as BookingLite[]) || []);
    setLastWeight(((wl as WeightLog[]) || [])[0] ?? null);
    const loadedPlans = await loadPlans(supabase);
    setIsElite(allows(loadedPlans, sub?.plan, "dietas", await loadGymExtras(supabase, m.gym_id)));
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

  /** Cuántas clases del plan ya usó el socio en el ciclo de cuota actual.
   *  Es solo para mostrar: al que frena de verdad es el trigger de la base. */
  async function recalcularCupo(m: Member, planes: RealPlan[] | null) {
    setMiPlan(planDelSocio(planes, m.plan_name));
    const base = topeDelPlan(planes, m.plan_name);
    if (!base) { setCupo(null); return; }
    // Las clases sueltas que le vendieron se suman a las del plan.
    const limite = base + (Number(m.clases_extra) || 0);
    const { ini, fin } = cicloDe(todayIso(), m.membership_expiry);
    const { count } = await supabase.from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", m.id).gt("class_date", ini).lte("class_date", fin);
    setCupo({ limite, usadas: count ?? 0 });
  }

  async function reservar(c: Klass, date: string) {
    if (!member) return;
    setBusyClassKey(c.id + date);
    setReservaErr("");
    const { data, error } = await supabase.from("bookings")
      // La sede sale de la clase. Sin esto la reserva queda sin sucursal y el
      // panel del dueño no la cuenta: filtra por sede y no la ve. Es el mismo
      // agujero que hizo desaparecer plata de Finanzas (ver CLAUDE.md).
      .insert({ gym_id: member.gym_id, sede_id: c.sede_id, class_id: c.id, member_id: member.id, class_date: date })
      .select("id, class_id, member_id, class_date").single<BookingLite>();
    if (error) {
      // El trigger del tope devuelve un mensaje ya escrito para el socio.
      setReservaErr(error.message || "No se pudo reservar. Probá de nuevo.");
    } else if (data) {
      setAllBookings((bs) => [...bs, data]);
      setMyBookings((mb) => [...mb, { id: data.id, class_id: c.id, class_date: date, classes: { name: c.name, start_time: c.start_time, instructor: c.instructor } }]);
      if (cupo) setCupo({ ...cupo, usadas: cupo.usadas + 1 });
    }
    setBusyClassKey(null);
  }
  async function cancelar(bookingId: string) {
    setBusyClassKey(bookingId);
    setReservaErr("");
    // Si el plazo ya pasó, el trigger de la base la frena y devuelve el motivo
    // escrito para el socio. Antes esto no se miraba y la fila desaparecía de
    // la pantalla aunque la reserva siguiera existiendo.
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
    if (error) {
      setReservaErr(error.message || "No se pudo cancelar. Probá de nuevo.");
      setBusyClassKey(null);
      return;
    }
    setAllBookings((bs) => bs.filter((b) => b.id !== bookingId));
    setMyBookings((mb) => mb.filter((b) => b.id !== bookingId));
    // Cancelar le devuelve el lugar, pero solo si la clase caía en este ciclo.
    if (member) await recalcularCupo(member, (gym as { real_plans?: RealPlan[] | null } | null)?.real_plans ?? null);
    setBusyClassKey(null);
  }

  // Cuántas clases le quedan al socio en el ciclo (null = plan sin tope).
  const restantes = cupo ? Math.max(0, cupo.limite - cupo.usadas) : Infinity;
  const sinCupo = cupo ? restantes <= 0 : false;

  // ── La grilla, día por día ────────────────────────────────────────────
  // Antes se listaba una fila por horario: un estudio con cuatro Zumbas veía
  // "Zumba" cuatro veces salteado por la lista. Ahora se elige el día y se ve
  // solo lo de ese día, en orden de hora.

  /** Días que tienen al menos una clase, de lunes a domingo. */
  const diasConClases = useMemo(
    () => DAYS
      .map((d) => ({ ...d, cuantas: classes.filter((c) => (c.weekdays || []).includes(d.code)).length }))
      .filter((d) => d.cuantas > 0),
    [classes],
  );

  /**
   * Hasta cuándo puede cancelar el socio, según lo que configuró el negocio.
   *
   * La misma regla la aplica el trigger `enforce_cancel_window` en la base: acá
   * solo es para que el botón no prometa algo que después va a fallar.
   */
  const cancelHoras = gym?.cancelacion_activa ? Number(gym.cancelacion_horas ?? 2) : null;

  /**
   * Hasta que fecha llega la cuota paga, si el negocio usa ese tope.
   *
   * null = no hay tope (la regla esta apagada, o el socio no tiene vencimiento
   * cargado). La misma regla la aplica el trigger `enforce_booking_expiry`.
   */
  const topeCuota = gym?.reserva_hasta_vencimiento ? (member?.membership_expiry || null) : null;
  const fueraDeCuota = (fecha: string | null) => !!topeCuota && !!fecha && fecha > topeCuota;
  const topeCuotaTexto = topeCuota
    ? new Date(topeCuota + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" })
    : "";

  /** Cuantas semanas se puede avanzar con la flecha, sin contar la actual. */
  const semanasAdelante = Math.max(
    0,
    Math.min(12, Number(gym?.reserva_semanas ?? RESERVA_SEMANAS_DEFECTO) || RESERVA_SEMANAS_DEFECTO) - 1,
  );

  function puedeCancelar(fecha: string, hora: string | null): boolean {
    if (cancelHoras === null) return true;
    return Date.now() <= arranqueDe(fecha, hora).getTime() - cancelHoras * 3600000;
  }

  /**
   * ¿Este estudio cargó fotos en sus clases?
   *
   * Si no cargó ninguna, la lista va sin la columna de la foto y queda igual de
   * prolija que antes. Nadie tiene que destildar nada: si no hay fotos, no hay
   * recuadros.
   */
  const hayFotos = useMemo(() => classes.some((c) => c.image_url), [classes]);

  /** El lunes de la semana que se está mirando. */
  const lunesSemana = useMemo(() => sumarDias(lunesDe(), semanaOffset * 7), [semanaOffset]);

  /** Las solapas de arriba: qué día es, qué fecha le toca y si ya pasó. */
  const solapas = useMemo(() => {
    const hoy = todayIso();
    return diasConClases.map((d) => {
      const fecha = fechaDeDia(lunesSemana, d.code) || "";
      return { ...d, fecha, numero: Number(fecha.slice(8, 10)), pasado: fecha < hoy };
    });
  }, [diasConClases, lunesSemana]);

  // El día elegido tiene que existir y no haber pasado. Al abrir la app cae en
  // hoy; al cambiar de semana, en el primer día disponible de esa semana.
  useEffect(() => {
    if (solapas.some((t) => t.code === diaSel && !t.pasado)) return;
    const primero = solapas.find((t) => !t.pasado);
    setDiaSel(primero ? primero.code : null);
  }, [solapas, diaSel]);

  /** La fecha real de la solapa elegida: todas sus clases se reservan ahí. */
  const fechaSel = useMemo(
    () => solapas.find((t) => t.code === diaSel)?.fecha || null,
    [solapas, diaSel],
  );

  const clasesDelDia = useMemo(
    () => (diaSel
      ? classes
        .filter((c) => (c.weekdays || []).includes(diaSel))
        .slice()
        .sort((a, b) => fmtTime(a.start_time).localeCompare(fmtTime(b.start_time)))
      : []),
    [classes, diaSel],
  );

  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes();

  if (state === "loading") return <main className="grid min-h-screen place-items-center text-ink-2">Cargando…</main>;

  if (state === "nomember") return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-2xl font-bold">No encontramos tu ficha</h1>
        <p className="mt-2 text-ink-2">
          Tu cuenta todavía no está vinculada. Pedí que te carguen como socio con este mismo email,
          y volvé a entrar.
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

  // Datos para la tarjeta de identidad centrada del socio.
  const initials =
    member!.full_name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "S";
  const membCentral =
    d === null ? "Sin membresía activa"
    : d < 0 ? "Membresía vencida"
    : d <= 7 ? `Vence en ${d} días`
    : "Membresía activa";
  const fdateVence = member!.membership_expiry
    ? new Date(member!.membership_expiry + "T00:00:00").toLocaleDateString("es-AR")
    : null;

  // Día seleccionado en Rutina y en Dieta (para mostrar solo ese día).
  const curRutIdx = days.length ? Math.min(rutDayIdx, days.length - 1) : 0;
  const curRutDay = days[curRutIdx];
  const curDietIdx = dietDays.length ? Math.min(dietDayIdx, dietDays.length - 1) : 0;
  const curDietDay = dietDays[curDietIdx];

  // La pestaña Dieta aparece si el gimnasio es Elite o si el socio ya tiene una dieta asignada.
  const showDiet = isElite || !!diet;

  // Secciones que el dueño ocultó a los socios desde "Secciones" (app del cliente).
  const hiddenMember = gym?.hidden_member_sections || [];
  const visibleTabs = BASE_TABS.filter(
    (t) => (t.key !== "dieta" || showDiet) && !hiddenMember.includes(t.key)
  );
  // Si la pestaña activa quedó oculta, mostramos "Mi perfil" (siempre disponible).
  const effTab: TabKey = visibleTabs.some((t) => t.key === tab) ? tab : "perfil";

  const waHref = gym?.whatsapp
    ? `https://wa.me/${gym.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hola! Quiero abonar mi cuota${member!.plan_name ? ` del plan ${member!.plan_name}` : ""}.`
      )}`
    : null;

  const qrText = `SOCIO: ${member!.full_name} | DNI: ${member!.dni || "-"} | ${gym?.name || "turnogym"}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(qrText)}`;

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <ThemeApply theme={gym?.theme} />
      {gym?.is_demo && member?.gym_id && <DemoVisitPing gymId={member.gym_id} kind="socio" />}
      <AppBackground style={gym?.bg_style} />
      {/* Barra de demo: volver al panel del dueño (solo en demos) */}
      {gym?.is_demo && gym?.slug && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/20 bg-[rgba(34,211,238,.06)] px-3 py-2 text-xs">
          <span className="text-ink-2">📲 Estás viendo la <b className="text-ink">app del cliente</b>.</span>
          <a href={`/demo/entrar?slug=${gym.slug}&rol=owner`}
            className="inline-flex items-center gap-1 rounded-lg bg-brand/15 px-3 py-1 font-semibold text-brand transition hover:bg-brand/25">
            🖥️ Volver al panel del dueño →
          </a>
        </div>
      )}
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {gym?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gym.logo_url} alt="" className="h-10 w-10 rounded-xl bg-white/5 object-contain p-0.5" />
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
      <div className="mb-5 grid gap-1 rounded-xl border border-white/10 bg-surface-2 p-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(visibleTabs.length, 1)}, minmax(0, 1fr))` }}>
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${effTab === t.key ? "bg-brand text-black" : "text-ink-2 hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {effTab === "perfil" && (
        <div className="flex flex-col gap-4">
          {/* Card 1: identidad del socio (centrada) */}
          <div className="card text-center">
            <div className="text-xs font-bold uppercase tracking-[2px] text-brand">{gym?.name || "Mi gimnasio"}</div>
            <div className="mx-auto mt-4 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-3xl font-black text-black">
              {initials}
            </div>
            <div className="mt-4 text-xl font-bold">{member!.full_name}</div>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${memb.chip}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {membCentral}
              </span>
            </div>
            <div className="mt-2 text-sm text-ink-2">
              {fdateVence ? `Vence el ${fdateVence}` : "Sin vencimiento"}
              {member!.plan_name ? ` · Plan ${member!.plan_name}` : ""}
            </div>
            {waHref ? (
              <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-primary mt-5 w-full text-center">
                Pagar abono mensual
              </a>
            ) : (
              <button
                className="btn btn-primary mt-5 w-full"
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

      {effTab === "rutina" && (
        <div className="flex flex-col gap-4">
          <div className="card p-0">
            <div className="border-b border-white/10 p-4">
              <h2 className="font-semibold">Mi rutina{routine?.name ? ` · ${routine.name.split(" — ")[0]}` : ""}</h2>
            </div>
            {days.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-2">Tu gimnasio todavía no te asignó una rutina.</p>
            ) : (
              <div className="p-4">
                {/* Selector de días (uno al lado del otro) */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {days.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => setRutDayIdx(i)}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                        curRutIdx === i
                          ? "border-brand bg-[rgba(34,211,238,.12)] text-brand"
                          : "border-white/10 bg-surface-2 text-ink-2 hover:text-ink"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                {/* Ejercicios SOLO del día elegido — sin recuadros anidados, a todo el ancho */}
                <div className="flex flex-col gap-5">
                  {curRutDay?.blocks.map((block, bi) => (
                    <div key={bi}>
                      {(curRutDay.blocks.length > 1 || block.name !== "Bloque 1") && (
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">{block.name}</div>
                      )}
                      <div className="flex flex-col divide-y divide-white/5">
                        {block.rows.map((re, j) => {
                          const ex = re.exercises;
                          const hasDemo = !!ex?.image_url;
                          const open = openDemo.has(re.id);
                          return (
                            <div key={re.id || j} className="py-2.5">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-[15px] font-medium leading-snug">{ex?.name || "Ejercicio"}</div>
                                  {re.notes && <div className="mt-0.5 text-xs text-muted">{re.notes}</div>}
                                  {hasDemo && (
                                    <button
                                      onClick={() => setOpenDemo((s) => { const n = new Set(s); n.has(re.id) ? n.delete(re.id) : n.add(re.id); return n; })}
                                      className="mt-1 text-xs font-semibold text-brand hover:underline">
                                      {open ? "Ocultar demostración" : "▸ Ver cómo se hace"}
                                    </button>
                                  )}
                                </div>
                                <div className="shrink-0 whitespace-nowrap text-sm font-semibold text-ink-2">
                                  {re.sets || "-"} × {re.reps || "-"}
                                </div>
                              </div>

                              {open && hasDemo && (
                                <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-surface-2">
                                  <div className="tg-exanim" style={{ aspectRatio: "4 / 3" }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={ex!.image_url!} alt={ex!.name} />
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img className="tg-end" src={ex!.image_url_end || ex!.image_url!} alt="" />
                                  </div>
                                  <div className="p-3">
                                    {((ex!.primary_muscles?.length ?? 0) > 0 || ex!.equipment) && (
                                      <div className="mb-2 flex flex-wrap gap-1.5">
                                        {(ex!.primary_muscles || []).map((m, i) => (
                                          <span key={i} className="rounded-full border border-brand/30 bg-[rgba(34,211,238,.1)] px-2 py-0.5 text-[11px] font-semibold text-brand">{m}</span>
                                        ))}
                                        {ex!.equipment && <span className="rounded-full border border-white/10 bg-surface px-2 py-0.5 text-[11px] text-ink-2">{ex!.equipment}</span>}
                                      </div>
                                    )}
                                    {(ex!.instructions?.length ?? 0) > 0 && (
                                      <ol className="list-decimal space-y-1 pl-4 text-xs text-ink-2">
                                        {ex!.instructions!.map((s, i) => <li key={i}>{s}</li>)}
                                      </ol>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Iniciar rutina DEBAJO de los ejercicios */}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Link href="/portal/entrenar" className="btn btn-primary flex-1 text-center">▶ Iniciar rutina</Link>
                  <Link href="/portal/progreso" className="btn btn-ghost flex-1 text-center">Ver mi progreso →</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {effTab === "dieta" && showDiet && (
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
                <h2 className="font-semibold">{diet.name ? diet.name.split(" — ")[0] : "Tu dieta"}</h2>
              </div>
              <div className="p-4">
                {/* Selector de días (uno al lado del otro) */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {dietDays.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => setDietDayIdx(i)}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                        curDietIdx === i
                          ? "border-brand bg-[rgba(34,211,238,.12)] text-brand"
                          : "border-white/10 bg-surface-2 text-ink-2 hover:text-ink"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                {/* Comidas SOLO del día elegido */}
                <div className="space-y-2">
                  {curDietDay?.meals.map((m) => (
                    <div key={m.id} className="flex items-start gap-3 rounded-lg border border-white/10 p-2">
                      {m.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white/5 text-lg">🍽️</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs uppercase tracking-wide text-muted">{m.meal_type}</div>
                        <div className="text-sm font-medium">{m.title || "—"}</div>
                        {m.detail && <div className="mt-0.5 whitespace-pre-wrap text-xs text-ink-2">{m.detail}</div>}
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

      {effTab === "clases" && (
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
                      {puedeCancelar(b.class_date, b.classes?.start_time ?? null) ? (
                        <button
                          className="text-xs text-ink-2 hover:text-crit"
                          disabled={busyClassKey === b.id}
                          onClick={() => cancelar(b.id)}
                        >
                          Cancelar
                        </button>
                      ) : (
                        <span className="text-xs text-muted"
                          title={`Se podía cancelar hasta ${cancelHoras} ${cancelHoras === 1 ? "hora" : "horas"} antes de que empiece`}>
                          Sin cancelar
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-0">
            <div className="border-b border-white/10 p-4">
              <h2 className="font-semibold">Todas las clases</h2>
              <p className="text-xs text-muted">Elegí el día y anotate en la clase que quieras.</p>
              {cancelHoras !== null && (
                <p className="mt-1 text-[11px] leading-snug text-muted">
                  {cancelHoras === 0
                    ? "Podés cancelar hasta que empiece la clase."
                    : `Podés cancelar hasta ${cancelHoras} ${cancelHoras === 1 ? "hora" : "horas"} antes de que empiece.`}
                  {" "}Después ya no, y si no vas te cuenta como clase usada.
                </p>
              )}

              {/* Cupo del plan. Solo aparece si el plan del socio tiene tope. */}
              {cupo && (
                <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                  restantes <= 0
                    ? "border-[#f5b13d]/30 bg-[rgba(245,177,61,.1)] text-[#f5b13d]"
                    : "border-white/10 bg-white/[.03] text-ink-2"
                }`}>
                  {restantes > 0 ? (
                    <>Te {restantes === 1 ? "queda" : "quedan"} <b className="text-ink">{restantes}</b> de {cupo.limite} clases este mes
                      {member?.plan_name ? <span className="text-muted"> · plan {member.plan_name.trim()}</span> : null}
                    </>
                  ) : (
                    <>Ya usaste las {cupo.limite} clases que incluye tu plan este mes. Podés cancelar una reserva para liberar un lugar.</>
                  )}
                </div>
              )}

              {reservaErr && (
                <div className="mt-3 rounded-lg border border-crit/30 bg-[rgba(240,82,82,.1)] px-3 py-2 text-xs text-crit">
                  {reservaErr}
                </div>
              )}
            </div>
            {classes.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-2">Tu gimnasio todavía no cargó clases.</p>
            ) : diasConClases.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-2">Las clases todavía no tienen días asignados.</p>
            ) : (
              <>
                {/* Qué semana se está mirando. */}
                <div className="flex items-center justify-between gap-2 px-3 pt-3">
                  <button type="button" aria-label="Semana anterior"
                    onClick={() => setSemanaOffset((n) => Math.max(0, n - 1))}
                    disabled={semanaOffset === 0}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-ink-2 transition enabled:hover:border-white/25 enabled:hover:text-ink disabled:opacity-25">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18" /></svg>
                  </button>
                  <span className="min-w-0 truncate text-center text-xs font-semibold text-ink-2">
                    {semanaOffset === 0 ? "Esta semana" : rangoSemana(lunesSemana)}
                  </span>
                  <button type="button" aria-label="Semana siguiente"
                    onClick={() => setSemanaOffset((n) => Math.min(semanasAdelante, n + 1))}
                    disabled={semanaOffset >= semanasAdelante}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-ink-2 transition enabled:hover:border-white/25 enabled:hover:text-ink disabled:opacity-25">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
                  </button>
                </div>

                {/* Solapas por día. Se reparten el ancho, así entran todas en
                    cualquier celular sin que el sábado quede cortado. */}
                <div className="flex gap-1 px-3 pb-1 pt-2">
                  {solapas.map((t) => {
                    const activo = t.code === diaSel && !t.pasado;
                    return (
                      <button key={t.code} type="button" onClick={() => setDiaSel(t.code)}
                        disabled={t.pasado} aria-pressed={activo}
                        title={t.pasado ? "Ese día ya pasó" : `${t.cuantas} ${t.cuantas === 1 ? "clase" : "clases"}`}
                        className={`min-w-0 flex-1 rounded-xl border px-0.5 py-1.5 text-center transition ${
                          t.pasado
                            ? "cursor-not-allowed border-white/5 opacity-35"
                            : activo
                              ? "border-transparent"
                              : "border-white/10 bg-surface-2 hover:border-white/25"
                        }`}
                        style={activo ? {
                          background: "linear-gradient(135deg, rgb(var(--brand-rgb)), rgb(var(--brand-2-rgb)))",
                          color: "var(--on-brand)",
                        } : undefined}>
                        <span className={`block text-[12px] font-bold leading-tight ${activo ? "" : "text-ink"}`}>{t.label}</span>
                        <span className={`block text-[10px] leading-tight tabular-nums ${activo ? "" : "text-muted"}`}>{t.numero}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="px-4 pb-1 text-xs text-muted">
                  {clasesDelDia.length} {clasesDelDia.length === 1 ? "clase" : "clases"}
                  {fechaSel ? ` · ${fechaLarga(fechaSel)}` : ""}
                </div>

                {semanaOffset >= semanasAdelante && (
                  <p className="px-4 pb-1 text-[11px] text-muted">
                    {semanasAdelante === 0
                      ? "Por ahora solo se reservan las clases de esta semana."
                      : `Hasta acá llegan las reservas: se abren ${semanasAdelante + 1} semanas antes.`}
                  </p>
                )}

                {fueraDeCuota(fechaSel) && (
                  <div className="mx-4 mb-2 rounded-lg border border-[#f5b13d]/30 bg-[rgba(245,177,61,.1)] px-3 py-2 text-[11px] leading-snug text-[#f5b13d]">
                    Tu cuota está paga hasta el{" "}
                    <b>{topeCuotaTexto}</b>.
                    Para anotarte a las clases de este día, renovala.
                  </div>
                )}

                <ul className="divide-y divide-white/5">
                  {clasesDelDia.map((c) => {
                    const date = fechaSel;
                    if (!date) return null;
                    const occupied = allBookings.filter((b) => b.class_id === c.id && b.class_date === date).length;
                    const mine = allBookings.find((b) => b.class_id === c.id && b.class_date === date && b.member_id === member!.id);
                    const full = c.capacity != null && occupied >= c.capacity;
                    const libres = c.capacity != null ? Math.max(0, c.capacity - occupied) : null;
                    const key = c.id + date;
                    // ¿Esta actividad entra en su plan? (ej: "Pase Libre" sin Kangoo)
                    const incluida = claseIncluida(miPlan, c.name);
                    // Una clase de hoy que ya arrancó no se puede reservar.
                    const yaPaso = date === todayIso() && c.start_time != null && minutosDe(c.start_time) <= ahoraMin;
                    // Clase posterior al vencimiento de su cuota.
                    const sinCuota = fueraDeCuota(date);
                    const color = c.color || "#22d3ee";
                    return (
                      <li key={key} className="flex gap-3 px-4 py-3">
                        <div className="w-[42px] shrink-0 pt-0.5 text-sm font-bold tabular-nums text-brand">
                          {fmtTime(c.start_time) || "—"}
                        </div>
                        {hayFotos && (c.image_url ? (
                          <img src={c.image_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-lg font-bold"
                            style={{ background: `${color}1f`, borderColor: `${color}4d`, color }}>
                            {inicialDe(c.name)}
                          </span>
                        ))}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{c.name.trim()}</div>
                          {c.instructor && <div className="truncate text-xs text-muted">con {c.instructor.trim()}</div>}
                          {!incluida && (
                            <div className="text-xs text-[#f5b13d]">No entra en tu plan · se contrata aparte</div>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {libres != null && (
                              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums ${
                                libres === 0
                                  ? "bg-[rgba(240,82,82,.14)] text-[#f87171]"
                                  : libres <= 3
                                    ? "bg-[rgba(245,177,61,.14)] text-[#f5b13d]"
                                    : "bg-[rgba(74,222,128,.14)] text-[#4ade80]"
                              }`}>
                                {libres === 0 ? "Sin lugar" : `${libres} ${libres === 1 ? "libre" : "libres"}`}
                              </span>
                            )}
                            {mine ? (
                              puedeCancelar(date, c.start_time) ? (
                                <button className="btn btn-ghost px-3 py-1 text-[11.5px]"
                                  disabled={busyClassKey === mine.id} onClick={() => cancelar(mine.id)}>
                                  Cancelar
                                </button>
                              ) : (
                                <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                                  Anotada · ya no se cancela
                                </span>
                              )
                            ) : (
                              <button
                                className="btn btn-primary px-3 py-1 text-[11.5px]"
                                disabled={full || !incluida || sinCupo || yaPaso || sinCuota || busyClassKey === key}
                                title={
                                  sinCuota
                                    ? `Tu cuota está paga hasta el ${topeCuotaTexto}. Renovala para anotarte a partir de ahí.`
                                    : yaPaso
                                    ? "Esta clase ya empezó"
                                    : !incluida
                                      ? `${c.name.trim()} no está incluida en tu plan${member?.plan_name ? ` ${member.plan_name.trim()}` : ""}`
                                      : sinCupo
                                        ? "Ya usaste todas las clases que incluye tu plan este mes"
                                        : undefined
                                }
                                onClick={() => reservar(c, date)}
                              >
                                {sinCuota ? "Sin cuota" : yaPaso ? "Ya pasó" : full ? "Cupo lleno" : !incluida ? "No incluida" : sinCupo ? "Sin clases" : "Reservar"}
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">turnogym · <Link href="/acceso" className="hover:text-brand">Cerrar sesión</Link></p>
    </main>
  );
}
