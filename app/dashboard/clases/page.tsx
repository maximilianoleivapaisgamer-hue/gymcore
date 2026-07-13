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

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
    setGymId(profile?.gym_id ?? null);
    const [{ data: cl }, { data: mem }] = await Promise.all([
      supabase.from("classes").select("*").order("start_time"),
      supabase.from("members").select("id, full_name").order("full_name"),
    ]);
    setClasses((cl as Klass[]) || []);
    setMembers((mem as Member[]) || []);
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

  const classesByDay = (code: string) =>
    classes.filter((c) => (c.weekdays || []).includes(code))
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const availableToAdd = members.filter((m) => !bookings.some((b) => b.member_id === m.id));
  const full = resFor?.capacity ? bookings.length >= resFor.capacity : false;

  return (
    <main className="p-5 md:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link>
            <span>/</span><span>Clases</span>
          </div>
          <h1 className="text-2xl font-bold">Clases</h1>
          <p className="text-ink-2">{classes.length} clases en la agenda semanal.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva clase</button>
      </div>

      {loading ? (
        <p className="p-8 text-center text-ink-2">Cargando…</p>
      ) : classes.length === 0 ? (
        <div className="card py-16 text-center text-ink-2">
          Todavía no cargaste clases. Tocá “+ Nueva clase” para armar tu agenda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {DAYS.map((d) => (
            <div key={d.code} className="rounded-xl border border-white/10 bg-surface p-2">
              <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-2">{d.label}</div>
              <div className="flex flex-col gap-2">
                {classesByDay(d.code).length === 0 ? (
                  <div className="px-1 py-4 text-center text-xs text-muted">—</div>
                ) : classesByDay(d.code).map((c) => (
                  <button key={c.id + d.code} onClick={() => openReservas(c)}
                    className="rounded-lg border-l-4 bg-surface-2 p-2 text-left transition hover:bg-white/[.05]"
                    style={{ borderLeftColor: c.color || "#22d3ee" }}>
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-ink-2">{fmtTime(c.start_time)}{c.duration ? ` · ${c.duration}′` : ""}</div>
                    {c.instructor && <div className="text-xs text-muted">{c.instructor}</div>}
                    {c.capacity != null && <div className="mt-1 text-[11px] text-muted">Cupo {c.capacity}</div>}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
