"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { cicloDe, topeDelPlan } from "@/lib/cupo-clases";
import { DAYS, dayLabels, fmtTime, inicialDe } from "@/lib/clases";
import type { RealPlan } from "@/types/db";
import { resolveActiveSede, type Sede } from "@/lib/sede";

interface Klass {
  id: string;
  name: string;
  type: string | null;
  instructor: string | null;
  weekdays: string[];
  start_time: string | null;
  duration: number | null;
  capacity: number | null;
  color: string | null;
  /** Foto opcional: la ven los socios en la app. */
  image_url: string | null;
}
interface Member { id: string; full_name: string; plan_name: string | null; membership_expiry: string | null; }
interface Booking { id: string; member_id: string; class_date: string; members?: { full_name: string } | null; }

const COLORS = ["#22d3ee", "#3b82f6", "#818cf8", "#22c55e", "#f5b13d", "#f05252"];


function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
/** Próxima fecha (desde hoy) que caiga en alguno de los días de la clase. */
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

const emptyForm = () => ({
  id: null as string | null,
  name: "", type: "", instructor: "",
  weekdays: [] as string[],
  start_time: "18:00", duration: "60", capacity: "12",
  color: COLORS[0],
  image_url: "",
});

/** Alto de una hora en el calendario semanal, en pixeles. */
const PX_HORA = 58;

function minutos(t: string | null): number {
  const [h, m] = fmtTime(t).split(":");
  return Number(h || 0) * 60 + Number(m || 0);
}

/**
 * La semana completa, con cada clase en su lugar real segun hora y duracion.
 *
 * Es la vista para mirar la grilla desde arriba: los huecos libres quedan como
 * espacios en blanco, asi se ve de una donde entra una clase nueva.
 */
function Semana({ classes, onPick }: { classes: Klass[]; onPick: (c: Klass) => void }) {
  const conHora = useMemo(
    () => classes.filter((c) => c.start_time && (c.weekdays || []).length > 0),
    [classes],
  );

  // El rango va de la primera clase a la ultima, redondeado a horas enteras.
  const { desde, hasta } = useMemo(() => {
    if (conHora.length === 0) return { desde: 7, hasta: 22 };
    let ini = 24 * 60, fin = 0;
    conHora.forEach((c) => {
      const m = minutos(c.start_time);
      ini = Math.min(ini, m);
      fin = Math.max(fin, m + (c.duration || 60));
    });
    return { desde: Math.max(0, Math.floor(ini / 60)), hasta: Math.min(24, Math.ceil(fin / 60)) };
  }, [conHora]);

  // Carriles: si dos clases del mismo dia se pisan, van una al lado de la otra
  // en vez de taparse.
  const porDia = useMemo(() => DAYS.map((d) => {
    const items = conHora
      .filter((c) => (c.weekdays || []).includes(d.code))
      .map((c) => ({ c, ini: minutos(c.start_time), fin: minutos(c.start_time) + (c.duration || 60) }))
      .sort((a, b) => a.ini - b.ini);
    const finDeCarril: number[] = [];
    const puestos = items.map((it) => {
      let carril = finDeCarril.findIndex((f) => f <= it.ini);
      if (carril < 0) { carril = finDeCarril.length; finDeCarril.push(it.fin); }
      else finDeCarril[carril] = it.fin;
      return { ...it, carril };
    });
    return { dia: d, items: puestos, carriles: Math.max(1, finDeCarril.length) };
  }), [conHora]);

  if (conHora.length === 0) {
    return (
      <p className="card p-8 text-center text-sm text-ink-2">
        Para ver la semana, tus clases tienen que tener dia y horario cargados.
      </p>
    );
  }

  const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i);
  const alto = horas.length * PX_HORA;
  const hoy = new Date().getDay();

  return (
    <div className="card overflow-x-auto p-0">
      <div className="min-w-[760px]">
        <div className="flex border-b border-white/10">
          <div className="w-14 shrink-0" />
          {DAYS.map((d) => (
            <div key={d.code}
              className={`flex-1 py-2.5 text-center text-xs font-semibold ${d.js === hoy ? "text-brand" : "text-ink-2"}`}>
              {d.label}{d.js === hoy ? " \u00b7 hoy" : ""}
            </div>
          ))}
        </div>

        <div className="flex">
          <div className="w-14 shrink-0">
            {horas.map((h) => (
              <div key={h} className="relative" style={{ height: PX_HORA }}>
                <span className="absolute -top-1.5 right-2 text-[10px] tabular-nums text-muted">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {porDia.map(({ dia, items, carriles }) => (
            <div key={dia.code}
              className={`relative flex-1 border-l border-white/5 ${dia.js === hoy ? "bg-white/[.02]" : ""}`}
              style={{ height: alto }}>
              {horas.map((h) => (
                <div key={h} className="border-b border-white/5" style={{ height: PX_HORA }} />
              ))}
              {items.map(({ c, ini, fin, carril }) => {
                const color = c.color || "#22d3ee";
                const ancho = 100 / carriles;
                return (
                  <button key={c.id + dia.code} onClick={() => onPick(c)}
                    title={`${c.name.trim()} \u00b7 ${fmtTime(c.start_time)}${c.instructor ? ` \u00b7 ${c.instructor.trim()}` : ""}`}
                    className="absolute overflow-hidden rounded-md px-1.5 py-1 text-left transition hover:brightness-125"
                    style={{
                      top: ((ini - desde * 60) / 60) * PX_HORA,
                      height: Math.max(26, ((fin - ini) / 60) * PX_HORA - 3),
                      left: `calc(${carril * ancho}% + 2px)`,
                      width: `calc(${ancho}% - 4px)`,
                      background: `${color}26`,
                      borderLeft: `3px solid ${color}`,
                    }}>
                    <div className="truncate text-[11px] font-semibold leading-tight">{c.name.trim()}</div>
                    <div className="truncate text-[10px] leading-tight text-ink-2">
                      {fmtTime(c.start_time)}{c.instructor ? ` \u00b7 ${c.instructor.trim()}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ClasesPage() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [sedeId, setSedeId] = useState<string | null>(null);
  const [sedeName, setSedeName] = useState<string>("");
  const [classes, setClasses] = useState<Klass[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  /** Planes del gimnasio, para saber el tope de clases de cada socio. */
  const [realPlans, setRealPlans] = useState<RealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  /** "tarjetas" (una por clase) o "semana" (calendario, para ver los huecos). */
  const [vista, setVista] = useState<"tarjetas" | "semana">("tarjetas");
  const fotoInput = useRef<HTMLInputElement | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoErr, setFotoErr] = useState("");
  // reservas
  const [resFor, setResFor] = useState<Klass | null>(null);
  const [resDate, setResDate] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [addMember, setAddMember] = useState("");
  const [allBookings, setAllBookings] = useState<{ class_id: string; class_date: string }[]>([]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
    setGymId(profile?.gym_id ?? null);
    // Sucursal activa: las clases y sus reservas se dividen por sede.
    let activeSede: string | null = null;
    if (profile?.gym_id) {
      const { data: sedeList } = await supabase.from("sedes")
        .select("id, gym_id, name, address, created_at").eq("gym_id", profile.gym_id)
        .order("created_at", { ascending: true });
      const arr = (sedeList as Sede[]) || [];
      activeSede = resolveActiveSede(profile.gym_id, arr);
      setSedeId(activeSede);
      setSedeName(arr.find((s) => s.id === activeSede)?.name || "");
      const { data: g } = await supabase.from("gyms").select("real_plans").eq("id", profile.gym_id)
        .maybeSingle<{ real_plans: RealPlan[] | null }>();
      setRealPlans(g?.real_plans || []);
    }
    // Filtro explícito por gimnasio: no dejar que el aislamiento dependa solo
    // de las políticas de la base (ver el comentario en app/portal/page.tsx).
    let qClasses = supabase.from("classes").select("*").eq("gym_id", profile?.gym_id ?? "").order("start_time");
    let qBookings = supabase.from("bookings").select("class_id, class_date").eq("gym_id", profile?.gym_id ?? "").gte("class_date", iso(new Date()));
    if (activeSede) { qClasses = qClasses.eq("sede_id", activeSede); qBookings = qBookings.eq("sede_id", activeSede); }
    const [{ data: cl }, { data: mem }, { data: bk }] = await Promise.all([
      qClasses,
      supabase.from("members").select("id, full_name, plan_name, membership_expiry").order("full_name"),
      qBookings,
    ]);
    setClasses((cl as Klass[]) || []);
    setMembers((mem as Member[]) || []);
    setAllBookings((bk as { class_id: string; class_date: string }[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const guardada = localStorage.getItem("tg_clases_vista");
    if (guardada === "semana" || guardada === "tarjetas") setVista(guardada);
  }, []);
  function cambiarVista(v: "tarjetas" | "semana") {
    setVista(v);
    localStorage.setItem("tg_clases_vista", v);
  }

  /** Sube la foto de la clase al mismo bucket público que el logo y la galería. */
  async function subirFoto(file: File) {
    setFotoErr("");
    if (!file.type.startsWith("image/")) { setFotoErr("Eso no es una imagen."); return; }
    if (file.size > 5 * 1024 * 1024) { setFotoErr("La foto pesa más de 5 MB. Probá con una más liviana."); return; }
    setSubiendoFoto(true);
    const path = `clases/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("gym-assets").upload(path, file, { upsert: true });
    if (error) { setFotoErr("No se pudo subir la foto. Probá de nuevo."); setSubiendoFoto(false); return; }
    const { data } = supabase.storage.from("gym-assets").getPublicUrl(path);
    setF("image_url", data.publicUrl);
    setSubiendoFoto(false);
  }

  // ---- form ----
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  function toggleDay(code: string) {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(code) ? f.weekdays.filter((d) => d !== code) : [...f.weekdays, code],
    }));
  }
  function openNew() { setForm(emptyForm()); setModal(true); }
  function openEdit(c: Klass) {
    setForm({
      id: c.id, name: c.name || "", type: c.type || "", instructor: c.instructor || "",
      weekdays: c.weekdays || [], start_time: fmtTime(c.start_time) || "18:00",
      duration: c.duration ? String(c.duration) : "60", capacity: c.capacity ? String(c.capacity) : "12",
      color: c.color || COLORS[0],
      image_url: c.image_url || "",
    });
    setModal(true);
  }

  async function saveClass() {
    if (!gymId || !form.name) return;
    setSaving(true);
    const payload = {
      gym_id: gymId,
      name: form.name,
      type: form.type || null,
      instructor: form.instructor || null,
      weekdays: form.weekdays,
      start_time: form.start_time || null,
      duration: form.duration ? Number(form.duration) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      color: form.color,
      image_url: form.image_url || null,
    };
    if (form.id) await supabase.from("classes").update(payload).eq("id", form.id);
    else await supabase.from("classes").insert({ ...payload, sede_id: sedeId });
    setSaving(false); setModal(false); load();
  }

  async function deleteClass(id: string) {
    if (!confirm("¿Eliminar esta clase?")) return;
    await supabase.from("classes").delete().eq("id", id);
    setModal(false); load();
  }

  // ---- reservas ----
  async function openReservas(c: Klass) {
    const date = nextOccurrence(c.weekdays);
    setResFor(c); setResDate(date); setAddMember(""); setBookings([]);
    if (date) {
      const { data } = await supabase
        .from("bookings").select("id, member_id, class_date, members(full_name)")
        .eq("class_id", c.id).eq("class_date", date);
      setBookings((data as Booking[]) || []);
    }
  }
  async function addBooking() {
    if (!gymId || !resFor || !resDate || !addMember) return;
    if (bookings.some((b) => b.member_id === addMember)) { setAddMember(""); return; }

    // El tope del plan no te frena a vos (podés regalar o cobrar una suelta),
    // pero te avisamos para que sepas que ese socio ya lo usó todo.
    const socio = members.find((m) => m.id === addMember);
    const limite = topeDelPlan(realPlans, socio?.plan_name);
    if (socio && limite) {
      const { ini, fin } = cicloDe(resDate, socio.membership_expiry);
      const { count } = await supabase.from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("member_id", socio.id).gt("class_date", ini).lte("class_date", fin);
      if ((count ?? 0) >= limite) {
        const ok = confirm(
          `${socio.full_name} ya usó las ${limite} clases que incluye su plan${socio.plan_name ? ` "${socio.plan_name.trim()}"` : ""} en este período.

` +
          `Si la anotás igual, queda como una clase extra. ¿La cargo?`
        );
        if (!ok) return;
      }
    }
    const { data } = await supabase.from("bookings")
      .insert({ gym_id: gymId, sede_id: sedeId, class_id: resFor.id, member_id: addMember, class_date: resDate })
      .select("id, member_id, class_date, members(full_name)").single();
    if (data) setBookings((bs) => [...bs, data as Booking]);
    setAddMember("");
  }
  async function removeBooking(id: string) {
    await supabase.from("bookings").delete().eq("id", id);
    setBookings((bs) => bs.filter((b) => b.id !== id));
  }

  const availableToAdd = members.filter((m) => !bookings.some((b) => b.member_id === m.id));
  const full = resFor?.capacity ? bookings.length >= resFor.capacity : false;

  const occFor = (c: Klass) => {
    const date = nextOccurrence(c.weekdays);
    if (!date) return 0;
    return allBookings.filter((b) => b.class_id === c.id && b.class_date === date).length;
  };
  // Mismo criterio que la app del socio: sin ninguna foto cargada, las
  // tarjetas van sin recuadro.
  const hayFotos = classes.some((c) => c.image_url);

  const BADGE: Record<string, string> = {
    ok: "bg-[rgba(34,197,94,.14)] text-[#4ade80]",
    info: "bg-brand/20 text-brand",
    crit: "bg-[rgba(240,82,82,.14)] text-[#f87171]",
  };

  return (
    <main className="p-5 md:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link>
            <span>/</span><span>Clases</span>
          </div>
          <h1 className="text-2xl font-bold">Clases y reservas</h1>
          <p className="text-ink-2">
            Grilla{sedeName ? <> de <span className="font-semibold text-ink">{sedeName}</span></> : ""}. Tocá una clase para ver y anotar reservas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* La semana sirve para mirar la grilla desde arriba y ver los huecos. */}
          <div className="flex rounded-[10px] border border-white/10 bg-surface p-0.5">
            {([["tarjetas", "Tarjetas"], ["semana", "Semana"]] as const).map(([v, txt]) => (
              <button key={v} onClick={() => cambiarVista(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${vista === v ? "bg-surface-3 text-ink" : "text-ink-2 hover:text-ink"}`}>
                {txt}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={openNew}>+ Nueva clase</button>
        </div>
      </div>

      {loading ? (
        <p className="p-8 text-center text-ink-2">Cargando…</p>
      ) : vista === "semana" ? (
        <Semana classes={classes} onPick={openReservas} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => {
            const cap = c.capacity || 0;
            const occ = occFor(c);
            const ratio = cap ? Math.min(1, occ / cap) : 0;
            const badge = cap && occ >= cap ? { cls: "crit", txt: "Completo" } : ratio >= 0.8 ? { cls: "ok", txt: "Casi lleno" } : { cls: "info", txt: "Disponible" };
            return (
              <button key={c.id} onClick={() => openReservas(c)} className="card text-left transition hover:border-brand/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {hayFotos && (c.image_url ? (
                      <img src={c.image_url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-sm font-bold"
                        style={{ background: `${c.color || "#22d3ee"}1f`, borderColor: `${c.color || "#22d3ee"}4d`, color: c.color || "#22d3ee" }}>
                        {inicialDe(c.name)}
                      </span>
                    ))}
                    <b className="truncate text-base">{c.name}</b>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${BADGE[badge.cls]}`}>
                    <i className="h-1.5 w-1.5 rounded-full bg-current" />{badge.txt}
                  </span>
                </div>
                <p className="mb-3.5 mt-1.5 text-sm text-ink-2">
                  {dayLabels(c.weekdays)}{c.start_time ? ` · ${fmtTime(c.start_time)}` : ""}{c.instructor ? ` · ${c.instructor}` : ""}
                </p>
                <div className="flex items-center justify-between text-[13px] text-ink-2">
                  <span>Cupos</span>
                  <span className="font-semibold text-ink">{occ}{cap ? ` / ${cap}` : ""}</span>
                </div>
                <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full"
                    style={{ width: `${cap ? ratio * 100 : 0}%`, background: cap && occ >= cap ? "#f05252" : "linear-gradient(90deg, rgb(var(--brand-rgb)), rgb(var(--brand-2-rgb)))" }} />
                </div>
              </button>
            );
          })}
          <button onClick={openNew}
            className="grid min-h-[150px] place-items-center rounded-xl border border-dashed border-white/15 text-muted transition hover:border-brand/40 hover:text-ink">
            <div className="text-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mx-auto mb-1"><path d="M12 5v14M5 12h14" /></svg>
              Crear nueva clase
            </div>
          </button>
        </div>
      )}

      {/* Modal crear/editar clase */}
      {modal && (
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setModal(false)}>
          <div className="card my-auto w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">{form.id ? "Editar clase" : "Nueva clase"}</h3>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Nombre (ej: Funcional)" value={form.name} onChange={(e) => setF("name", e.target.value)} />
                <input className="input" placeholder="Tipo (ej: HIIT)" value={form.type} onChange={(e) => setF("type", e.target.value)} />
              </div>
              <input className="input" placeholder="Instructor" value={form.instructor} onChange={(e) => setF("instructor", e.target.value)} />

              <div>
                <label className="mb-1 block text-xs text-ink-2">Días</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => (
                    <button key={d.code} onClick={() => toggleDay(d.code)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${form.weekdays.includes(d.code) ? "border-brand bg-brand/15 text-brand" : "border-white/10 bg-surface-2 text-ink-2"}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-ink-2">Horario</label>
                  <input className="input" type="time" value={form.start_time} onChange={(e) => setF("start_time", e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-2">Duración (min)</label>
                  <input className="input" type="number" value={form.duration} onChange={(e) => setF("duration", e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-2">Cupo</label>
                  <input className="input" type="number" value={form.capacity} onChange={(e) => setF("capacity", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-ink-2">Color</label>
                <div className="flex gap-2">
                  {COLORS.map((col) => (
                    <button key={col} onClick={() => setF("color", col)}
                      className={`h-7 w-7 rounded-full ring-2 transition ${form.color === col ? "ring-white" : "ring-transparent"}`}
                      style={{ backgroundColor: col }} aria-label={col} />
                  ))}
                </div>
              </div>

              {/* Foto de la clase: la ven los socios en la app, al lado del nombre. */}
              <div>
                <label className="mb-1 block text-xs text-ink-2">Foto (opcional)</label>
                <div className="flex items-center gap-3">
                  {form.image_url ? (
                    <img src={form.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-dashed border-white/15 text-muted">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-ghost text-xs" disabled={subiendoFoto}
                        onClick={() => fotoInput.current?.click()}>
                        {subiendoFoto ? "Subiendo\u2026" : form.image_url ? "Cambiar foto" : "Subir foto"}
                      </button>
                      {form.image_url && (
                        <button type="button" className="text-xs text-ink-2 hover:text-crit"
                          onClick={() => setF("image_url", "")}>
                          Quitar
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-snug text-muted">
                      La ven tus socios en la app cuando eligen la clase.
                      Si no le ponés foto a ninguna, la lista va sin recuadros y queda igual de prolija.
                    </p>
                  </div>
                </div>
                <input ref={fotoInput} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ""; }} />
                {fotoErr && <p className="mt-1.5 text-[11px] text-crit">{fotoErr}</p>}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              {form.id ? (
                <button className="text-sm text-ink-2 hover:text-crit" onClick={() => deleteClass(form.id!)}>Eliminar</button>
              ) : <span />}
              <div className="flex gap-2">
                <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveClass} disabled={saving || !form.name || form.weekdays.length === 0}>
                  {saving ? "Guardando…" : "Guardar clase"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal reservas */}
      {resFor && (
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setResFor(null)}>
          <div className="card my-auto w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: resFor.color || "#22d3ee" }} />
              <h3 className="text-lg font-bold">{resFor.name}</h3>
            </div>
            <p className="mb-4 text-sm text-ink-2">
              {fmtTime(resFor.start_time)}{resFor.instructor ? ` · ${resFor.instructor}` : ""}
              {resDate ? ` · próxima: ${new Date(resDate + "T00:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}` : ""}
            </p>

            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold">Reservas</span>
              <span className={full ? "text-crit" : "text-ink-2"}>{bookings.length}{resFor.capacity != null ? ` / ${resFor.capacity}` : ""}</span>
            </div>

            {resDate ? (
              <>
                <div className="mb-3 flex gap-2">
                  <select className="input" value={addMember} onChange={(e) => setAddMember(e.target.value)} disabled={full || availableToAdd.length === 0}>
                    <option value="">{full ? "Cupo completo" : availableToAdd.length === 0 ? "Todos anotados" : "— Anotar socio —"}</option>
                    {availableToAdd.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={addBooking} disabled={!addMember || full}>Anotar</button>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {bookings.length === 0 ? (
                    <p className="py-4 text-center text-sm text-ink-2">Nadie anotado todavía.</p>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {bookings.map((b) => (
                        <li key={b.id} className="flex items-center justify-between py-2">
                          <span className="text-sm">{b.members?.full_name || "Socio"}</span>
                          <button className="text-ink-2 hover:text-crit" title="Quitar" onClick={() => removeBooking(b.id)}>×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-sm text-ink-2">Esta clase no tiene días asignados.</p>
            )}

            <div className="mt-4 flex justify-between">
              <button className="btn btn-ghost" onClick={() => { setResFor(null); openEdit(resFor); }}>Editar clase</button>
              <button className="btn btn-ghost" onClick={() => setResFor(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
