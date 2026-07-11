"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

interface Member {
  id: string; gym_id: string; full_name: string;
  plan_name: string | null; plan_price: number | null; membership_expiry: string | null;
}
interface RExercise { day_number: number; block_name: string | null; position: number; sets: string | null; reps: string | null; notes: string | null; exercises: { name: string } | null; }
interface Routine { id: string; name: string | null; routine_exercises: RExercise[]; }
interface Booking { id: string; class_date: string; classes: { name: string; start_time: string | null; instructor: string | null } | null; }

function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return Math.ceil((new Date(expiry + "T00:00:00").getTime() - Date.now()) / 86400000);
}
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : "");

export default function PortalPage() {
  const supabase = createClient();
  const [state, setState] = useState<"loading" | "nomember" | "ok">("loading");
  const [member, setMember] = useState<Member | null>(null);
  const [gym, setGym] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/acceso"; return; }
      const { data: m } = await supabase
        .from("members").select("id, gym_id, full_name, plan_name, plan_price, membership_expiry")
        .eq("linked_user_id", user.id).maybeSingle<Member>();
      if (!m) { setState("nomember"); return; }
      setMember(m);

      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const [{ data: g }, { data: r }, { data: b }] = await Promise.all([
        supabase.from("gyms").select("name, logo_url").eq("id", m.gym_id).maybeSingle<{ name: string; logo_url: string | null }>(),
        supabase.from("routines").select("id, name, routine_exercises(day_number, block_name, position, sets, reps, notes, exercises(name))")
          .eq("member_id", m.id).order("created_at", { ascending: false }).limit(1).maybeSingle<Routine>(),
        supabase.from("bookings").select("id, class_date, classes(name, start_time, instructor)")
          .eq("member_id", m.id).gte("class_date", iso).order("class_date"),
      ]);
      setGym(g ?? null);
      setRoutine((r as Routine) ?? null);
      setBookings((b as Booking[]) || []);
      setState("ok");
    })();
    /* eslint-disable-next-line */
  }, []);

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
    return Object.keys(by).map(Number).sort((a, b) => a - b).map((d) => ({
      label: by[d][0]?.block_name || `Día ${d}`, rows: by[d],
    }));
  }, [routine]);

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
    ? { label: "Sin membresía activa", cls: "text-ink-2" }
    : d < 0 ? { label: `Venció hace ${Math.abs(d)} días`, cls: "text-crit" }
    : d <= 7 ? { label: `Vence en ${d} días`, cls: "text-warn" }
    : { label: "Membresía activa", cls: "text-good" };

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
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

      {/* Membresía */}
      <div className="card mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Mi membresía</div>
            <div className="mt-1 text-lg font-bold">{member!.plan_name || "Sin plan asignado"}</div>
            {member!.plan_price != null && <div className="text-sm text-ink-2">{money(member!.plan_price)} / mes</div>}
          </div>
          <div className="text-right">
            <div className={`font-semibold ${memb.cls}`}>{memb.label}</div>
            {member!.membership_expiry && (
              <div className="text-xs text-muted">
                Vence el {new Date(member!.membership_expiry + "T00:00:00").toLocaleDateString("es-AR")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rutina */}
      <div className="card mb-4 p-0">
        <div className="border-b border-white/10 p-4">
          <h2 className="font-semibold">Mi rutina{routine?.name ? ` · ${routine.name}` : ""}</h2>
        </div>
        {days.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-2">Tu gimnasio todavía no te asignó una rutina.</p>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {days.map((day, i) => (
              <div key={i}>
                <div className="mb-2 text-sm font-semibold text-brand">{day.label}</div>
                <div className="overflow-hidden rounded-lg border border-white/10">
                  {day.rows.map((re, j) => (
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
        )}
      </div>

      {/* Próximas clases */}
      <div className="card p-0">
        <div className="border-b border-white/10 p-4">
          <h2 className="font-semibold">Mis próximas clases</h2>
        </div>
        {bookings.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-2">No tenés clases reservadas.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{b.classes?.name || "Clase"}</div>
                  {b.classes?.instructor && <div className="text-xs text-muted">{b.classes.instructor}</div>}
                </div>
                <div className="text-right text-sm text-ink-2">
                  <div>{new Date(b.class_date + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}</div>
                  {b.classes?.start_time && <div className="text-xs text-muted">{fmtTime(b.classes.start_time)}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted">GymCore · <Link href="/acceso" className="hover:text-brand">Cerrar sesión</Link></p>
    </main>
  );
}
