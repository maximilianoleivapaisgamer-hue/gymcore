"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { allows, loadPlans, DEFAULT_PLANS, type PlanConfig } from "@/lib/plans";
import { resolveActiveSede, type Sede } from "@/lib/sede";

interface Member {
  id: string;
  full_name: string;
  dni: string | null;
  plan_name: string | null;
  membership_expiry: string | null;
}

type Result =
  | { kind: "ok"; m: Member; expiry: string | null }
  | { kind: "blocked"; m: Member; expiry: string | null }
  | { kind: "notfound" }
  | null;

function daysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  return Math.ceil((new Date(expiry + "T00:00:00").getTime() - Date.now()) / 86400000);
}

export default function ControlAccesoPage() {
  const supabase = createClient();
  const [dni, setDni] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [today, setToday] = useState<{ name: string; time: string; ok: boolean }[]>([]);
  const [plan, setPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [gymId, setGymId] = useState<string | null>(null);
  const [sedeId, setSedeId] = useState<string | null>(null);
  const [sedeName, setSedeName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingPlan(false); return; }
      const { data: profile } = await supabase
        .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
      if (profile?.gym_id) {
        setGymId(profile.gym_id);
        const { data: sub } = await supabase
          .from("subscriptions").select("plan").eq("gym_id", profile.gym_id).maybeSingle<{ plan: string }>();
        setPlan(sub?.plan ?? null);
        setPlans(await loadPlans(supabase));
        // Sucursal activa: cada ingreso se registra en la sede desde la que se valida.
        const { data: sedeList } = await supabase.from("sedes")
          .select("id, gym_id, name, address, created_at").eq("gym_id", profile.gym_id)
          .order("created_at", { ascending: true });
        const arr = (sedeList as Sede[]) || [];
        const active = resolveActiveSede(profile.gym_id, arr);
        setSedeId(active);
        setSedeName(arr.find((s) => s.id === active)?.name || "");
        // Ingresos de hoy de esta sede (persistidos).
        const start = new Date(); start.setHours(0, 0, 0, 0);
        let qAtt = supabase.from("attendances")
          .select("entered_at, status, members(full_name)")
          .gte("entered_at", start.toISOString())
          .order("entered_at", { ascending: false }).limit(50);
        if (active) qAtt = qAtt.eq("sede_id", active);
        const { data: att } = await qAtt;
        setToday(((att as { entered_at: string; status: string | null; members?: { full_name: string } | null }[]) || []).map((a) => ({
          name: a.members?.full_name || "Socio",
          time: new Date(a.entered_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
          ok: a.status === "ok",
        })));
      }
      setLoadingPlan(false);
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  async function validar() {
    const q = dni.trim();
    if (!q) return;
    setBusy(true);
    const { data } = await supabase
      .from("members")
      .select("id, full_name, dni, plan_name, membership_expiry")
      .eq("dni", q)
      .maybeSingle<Member>();
    setBusy(false);
    if (!data) { setResult({ kind: "notfound" }); return; }
    const d = daysLeft(data.membership_expiry);
    const ok = d !== null && d >= 0;
    setResult(ok ? { kind: "ok", m: data, expiry: data.membership_expiry } : { kind: "blocked", m: data, expiry: data.membership_expiry });
    // Registrar el ingreso en la base, asociado a la sucursal activa.
    if (gymId) {
      await supabase.from("attendances").insert({
        gym_id: gymId,
        sede_id: sedeId,
        member_id: data.id,
        entered_at: new Date().toISOString(),
        status: ok ? "ok" : "vencido",
      });
    }
    const time = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    setToday((t) => [{ name: data.full_name, time, ok }, ...t].slice(0, 50));
    setDni("");
  }

  if (!loadingPlan && !allows(plans, plan, "control_acceso")) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="mb-2 text-4xl">🚪</div>
        <h1 className="text-2xl font-bold">Control de acceso está en los planes Pro y Elite</h1>
        <p className="mt-2 text-ink-2">
          Validar el ingreso de tus socios por DNI/QR está disponible a partir del plan Pro de turnogym.
        </p>
        <Link href="/dashboard/mi-plan" className="btn btn-primary mt-5 inline-block">Ver planes</Link>
      </main>
    );
  }

  return (
    <main className="p-5 md:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Link href="/dashboard" className="hover:text-brand">Panel</Link><span>/</span><span>Control de acceso</span>
          </div>
          <h1 className="text-2xl font-bold tracking-[-.5px]">Control de acceso</h1>
          <p className="mt-1 text-ink-2">
            Check-in por DNI{sedeName ? <> en <span className="font-semibold text-ink">{sedeName}</span></> : ""}. El sistema valida la membresía en el momento.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(34,197,94,.14)] px-3 py-1 text-xs font-semibold text-good">
          <i className="h-1.5 w-1.5 rounded-full bg-current" /> Escáner activo
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Validador */}
        <div className="card">
          <div className="mx-auto grid max-w-sm place-items-center py-2 text-center">
            <div className="grid h-[220px] w-[220px] place-items-center rounded-2xl border border-white/[.08] bg-surface-2 text-muted">
              <svg viewBox="0 0 24 24" width="90" height="90" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" /><path d="M14 14h3v3M20 14v6M14 20h3" />
              </svg>
            </div>
            <div className="mt-3 font-semibold">Escaneá el QR del socio</div>
            <p className="mt-1 text-sm text-ink-2">Cada socio tiene su QR en el portal. O ingresá el DNI manualmente.</p>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="input flex-1"
              placeholder="DNI del socio…"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && validar()}
            />
            <button className="btn btn-primary" onClick={validar} disabled={busy || !dni.trim()}>
              {busy ? "Validando…" : "Validar"}
            </button>
          </div>

          {result && (
            <div className="mt-4">
              {result.kind === "notfound" ? (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-3 text-xl">🔎</div>
                  <div><div className="font-bold">Socio no encontrado</div><div className="text-sm text-ink-2">No hay ningún socio con ese DNI.</div></div>
                </div>
              ) : result.kind === "ok" ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-good/30 bg-[rgba(34,197,94,.08)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-good text-lg text-black">✓</div>
                    <div>
                      <div className="font-bold">Acceso permitido · {result.m.full_name}</div>
                      <div className="text-sm text-ink-2">
                        {result.m.plan_name || "Sin plan"}{result.expiry ? ` · vence ${new Date(result.expiry + "T00:00:00").toLocaleDateString("es-AR")}` : ""}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(34,197,94,.14)] px-2.5 py-1 text-xs font-semibold text-good"><i className="h-1.5 w-1.5 rounded-full bg-current" />Al día</span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-crit/30 bg-[rgba(240,82,82,.08)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-crit text-lg text-white">✕</div>
                    <div>
                      <div className="font-bold">Acceso bloqueado · {result.m.full_name}</div>
                      <div className="text-sm text-ink-2">
                        {result.expiry ? `Membresía vencida el ${new Date(result.expiry + "T00:00:00").toLocaleDateString("es-AR")}` : "Sin membresía activa"}
                      </div>
                    </div>
                  </div>
                  <Link href="/dashboard/socios" className="btn btn-ghost text-xs">Cobrar y habilitar</Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ingresos de hoy */}
        <div className="card p-0">
          <div className="flex items-center justify-between border-b border-white/[.08] p-4">
            <h3 className="text-base font-semibold">Ingresos de hoy</h3>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">{today.length}</span>
          </div>
          {today.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-2">Todavía no hay ingresos registrados hoy. Validá un DNI para empezar.</p>
          ) : (
            <ul className="divide-y divide-white/[.06]">
              {today.map((t, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-500 text-[11px] font-bold">
                      {t.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div><div className="text-sm font-medium">{t.name}</div><div className="text-xs text-muted">{t.time}</div></div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${t.ok ? "bg-[rgba(34,197,94,.14)] text-good" : "bg-[rgba(240,82,82,.14)] text-[#f87171]"}`}>
                    <i className="h-1.5 w-1.5 rounded-full bg-current" />{t.ok ? "OK" : "Vencido"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-white/[.08] p-3 text-xs text-muted">
            Cada ingreso queda registrado en {sedeName || "esta sucursal"}. La lista muestra los check-in de hoy.
          </p>
        </div>
      </div>
    </main>
  );
}
