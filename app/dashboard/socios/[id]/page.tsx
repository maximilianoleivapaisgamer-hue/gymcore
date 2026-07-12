"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { PAY_METHODS, type PayMethod } from "@/types/db";

interface Member {
  id: string; full_name: string; dni: string | null; email: string | null; whatsapp: string | null;
  plan_name: string | null; plan_price: number | null; membership_expiry: string | null;
  observacion: string | null; reminder_whatsapp: boolean; reminder_email: boolean;
}
interface Payment { id: string; date: string; concept: string | null; amount: number; method: PayMethod | null; plan_name: string | null; }
interface Routine { id: string; name: string | null; is_template: boolean; created_at: string; }

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const methodLabel = (m: string | null) => PAY_METHODS.find((x) => x.value === m)?.label || "—";

function statusOf(expiry: string | null): { label: string; cls: string } {
  if (!expiry) return { label: "Sin plan", cls: "bg-white/5 text-muted" };
  const days = Math.ceil((new Date(expiry + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Vencido", cls: "bg-[rgba(240,82,82,.14)] text-[#f87171]" };
  if (days <= 7) return { label: "Vence pronto", cls: "bg-[rgba(245,177,61,.14)] text-[#f5b13d]" };
  return { label: "Activo", cls: "bg-[rgba(34,197,94,.14)] text-[#4ade80]" };
}

export default function SocioDetallePage() {
  const supabase = createClient();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: pays }, { data: rout }] = await Promise.all([
        supabase.from("members").select("*").eq("id", id).single<Member>(),
        supabase.from("cashflow_entries").select("id, date, concept, amount, method, plan_name")
          .eq("member_id", id).order("date", { ascending: false }),
        supabase.from("routines").select("id, name, is_template, created_at")
          .eq("member_id", id).order("created_at", { ascending: false }),
      ]);
      setMember(m ?? null);
      setPayments((pays as Payment[]) || []);
      setRoutines((rout as Routine[]) || []);
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, [id]);

  if (loading) return <main className="p-8 text-center text-ink-2">Cargando…</main>;
  if (!member) return (
    <main className="mx-auto max-w-3xl px-6 py-8 text-center">
      <p className="text-ink-2">No se encontró el socio.</p>
      <Link href="/dashboard/socios" className="mt-3 inline-block text-brand hover:underline">← Volver a Socios</Link>
    </main>
  );

  const st = statusOf(member.membership_expiry);
  const totalPagado = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
          <Link href="/dashboard" className="hover:text-brand">Panel</Link>
          <span>/</span>
          <Link href="/dashboard/socios" className="hover:text-brand">Socios</Link>
          <span>/</span><span>{member.full_name}</span>
        </div>
        <h1 className="text-2xl font-bold">{member.full_name}</h1>
      </div>

      {/* DATOS DEL SOCIO */}
      <div className="card mb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">DNI</div>
            <div className="mt-0.5">{member.dni || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Contacto</div>
            <div className="mt-0.5">{member.email || "—"} {member.whatsapp ? `· ${member.whatsapp}` : ""}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Plan</div>
            <div className="mt-0.5">{member.plan_name || "—"} {member.plan_price ? `· ${money(member.plan_price)}` : ""}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Vencimiento</div>
            <div className="mt-1 flex items-center gap-2">
              <span>{member.membership_expiry ? new Date(member.membership_expiry + "T00:00:00").toLocaleDateString("es-AR") : "—"}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
            </div>
          </div>
          {member.observacion && (
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted">Observación</div>
              <div className="mt-0.5 text-ink-2">{member.observacion}</div>
            </div>
          )}
          <div className="sm:col-span-2 text-xs text-muted">
            Recordatorios: {member.reminder_whatsapp ? "💬 WhatsApp" : ""} {member.reminder_email ? "✉️ Email" : ""}
            {!member.reminder_whatsapp && !member.reminder_email && "Desactivados"}
          </div>
        </div>
        <div className="mt-4">
          <Link href="/dashboard/socios" className="btn btn-ghost text-sm">✏️ Editar en Socios</Link>
        </div>
      </div>

      {/* HISTORIAL DE PAGOS */}
      <div className="card mb-6 p-0">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <span className="text-sm font-semibold">Historial de pagos</span>
          <span className="text-sm text-ink-2">Total: {money(totalPagado)}</span>
        </div>
        {payments.length === 0 ? (
          <p className="p-8 text-center text-ink-2">Todavía no hay cobros registrados a este socio.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 pb-3 pt-1">Fecha</th>
                  <th className="px-4 pb-3 pt-1">Concepto</th>
                  <th className="px-4 pb-3 pt-1">Medio</th>
                  <th className="px-4 pb-3 pt-1 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="px-4 py-3 text-ink-2">{new Date(p.date + "T00:00:00").toLocaleDateString("es-AR")}</td>
                    <td className="px-4 py-3">{p.concept || p.plan_name || "—"}</td>
                    <td className="px-4 py-3 text-ink-2">{methodLabel(p.method)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-good">+{money(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RUTINAS ASIGNADAS */}
      <div className="card p-0">
        <div className="border-b border-white/10 p-4 text-sm font-semibold">Rutinas asignadas</div>
        {routines.length === 0 ? (
          <p className="p-8 text-center text-ink-2">
            Este socio todavía no tiene rutinas asignadas. Andá a{" "}
            <Link href="/dashboard/rutinas" className="text-brand">Rutinas</Link> para aplicarle una plantilla.
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {routines.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <span>{r.name || "Rutina sin nombre"}</span>
                <Link href="/dashboard/rutinas" className="text-sm text-brand hover:underline">Ver / editar →</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
