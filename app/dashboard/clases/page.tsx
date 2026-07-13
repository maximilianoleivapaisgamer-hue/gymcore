"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

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
}
interface Member { id: string; full_name: string; }
interface Booking { id: string; member_id: string; class_date: string; members?: { full_name: string } | null; }

const DAYS = [
  { code: "lun", label: "Lun", js: 1 },
  { code: "mar", label: "Mar", js: 2 },
  { code: "mie", label: "Mié", js: 3 },
  { code: "jue", label: "Jue", js: 4 },
  { code: "vie", label: "Vie", js: 5 },
  { code: "sab", label: "Sáb", js: 6 },
  { code: "dom", label: "Dom", js: 0 },
];
const COLORS = ["#22d3ee", "#3b82f6", "#818cf8", "#22c55e", "#f5b13d", "#f05252"];

const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "");

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
});

export default function ClasesPage() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [classes, setClasses] = useState<Klass[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
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
    const [{ data: cl }, { data: mem }, { data: bk }] = await Promise.all([
      supabase.from("classes").select("*").order("start_time"),
      supabase.from("members").select("id, full_name").order("full_name"),
      supabase.from("bookings").select("class_id, class_date").gte("class_date", iso(new Date())),
    ]);
    setClasses((cl as Klass[]) || []);
    setMembers((mem as Member[]) || []);
    setAllBookings((bk as { class_id: string; class_date: string }[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

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
    };
    if (form.id) await supabase.from("classes").update(payload).eq("id", form.id);
    else await supabase.from("classes").insert(payload);
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
    const { data } = await supabase.from("bookings")
      .insert({ gym_id: gymId, class_id: resFor.id, member_id: addMember, class_date: resDate })
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
  const dayLabels = (codes: string[]) =>
    (codes || []).map((code) => DAYS.find((d) => d.code === code)?.label).filter(Boolean).join("/");
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
          <p className="text-ink-2">Armá la grilla a tu manera. Tocá una clase para ver y anotar reservas.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva clase</button>
      </div>

      {loading ? (
        <p className="p-8 text-center text-ink-2">Cargando…</p>
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
                  <b className="text-base">{c.name}</b>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${BADGE[badge.cls]}`}>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setModal(false)}>
          <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setResFor(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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
