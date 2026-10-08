"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SimuladorResultado from "@/components/SimuladorResultado";
import { createClient } from "@/lib/supabase-browser";
import { resolveActiveSede, type Sede } from "@/lib/sede";
import { nuevoVencimiento, fechaCorta, hoyISO, recargoDe, mesesOpciones, mesQueCubre, nombreMes, type CobroConfig } from "@/lib/fechas";
import { PAY_METHODS, type PayMethod, type RealPlan } from "@/types/db";
import { allows, loadPlans, loadGymExtras } from "@/lib/plans";
import { cicloDe, topeDelPlan } from "@/lib/cupo-clases";
import { ubicarEntrada, type ClaseConHorario } from "@/lib/asistencias";

interface Member {
  id: string; gym_id: string; member_number: number | null;
  full_name: string; dni: string | null; email: string | null; whatsapp: string | null;
  plan_name: string | null; plan_price: number | null; membership_expiry: string | null;
  observacion: string | null; reminder_whatsapp: boolean; reminder_email: boolean;
  height_cm: number | null; created_at: string;
  /** Cupos extra por clases sueltas vendidas (migration_043). */
  clases_extra?: number | null;
}
interface Payment { id: string; date: string; concept: string | null; amount: number; method: PayMethod | null; plan_name: string | null; }
interface Routine { id: string; name: string | null; is_template: boolean; created_at: string; }
interface Diet { id: string; name: string | null; is_template: boolean; created_at: string; }

interface ClaseGym { id: string; name: string | null; start_time: string | null; weekdays: string[] | null }
interface Reserva { class_id: string; class_date: string }
interface Entrada { entered_at: string }

/** Una fila del historial de clases. */
interface FilaClase {
  clave: string; fecha: string; clase: string; hora: string | null;
  reservo: boolean; entrada: string | null; suelta: boolean;
}

/**
 * El historial de clases del socio: lo que reservó y lo que el control de
 * acceso dice que pasó, en una sola lista.
 *
 * Lo pidió DanzArte después de un caso concreto: una socia pagó, la app le
 * decía "te quedan 5 de 8" y la dueña no tenía dónde ver CUÁLES tres había
 * usado, así que no podía ni confirmarlo ni discutirlo.
 *
 * Reservar y entrar el mismo día a la misma clase es UNA fila, no dos.
 */
function historialDeClases(reservas: Reserva[], entradas: Entrada[], clases: ClaseGym[]): FilaClase[] {
  const nombreDe = new Map(clases.map((c) => [c.id, c.name || "Clase"]));
  const horaDe = new Map(clases.map((c) => [c.id, c.start_time ? String(c.start_time).slice(0, 5) : null]));
  const filas = new Map<string, FilaClase>();

  reservas.forEach((r) => {
    const fecha = String(r.class_date).slice(0, 10);
    const clave = `${r.class_id}|${fecha}`;
    filas.set(clave, {
      clave, fecha, clase: nombreDe.get(r.class_id) || "Clase",
      hora: horaDe.get(r.class_id) ?? null, reservo: true, entrada: null, suelta: false,
    });
  });

  entradas.forEach((e) => {
    const u = ubicarEntrada(e.entered_at, clases as ClaseConHorario[]);
    if (u.class_id) {
      const clave = `${u.class_id}|${u.fecha}`;
      const ya = filas.get(clave);
      if (ya) { ya.entrada = u.hora; return; }   // reservó Y vino: una sola fila
      filas.set(clave, {
        clave, fecha: u.fecha, clase: nombreDe.get(u.class_id) || "Clase",
        hora: horaDe.get(u.class_id) ?? null, reservo: false, entrada: u.hora, suelta: false,
      });
      return;
    }
    // Entró pero no cae en ninguna clase, o cae en dos y no se puede saber en
    // cuál. Se muestra igual: esconder una entrada real hace dudar del resto.
    const clave = `entrada|${u.fecha}|${u.hora}`;
    filas.set(clave, {
      clave, fecha: u.fecha,
      clase: u.ambiguo ? "Entró (hay dos clases a esa hora)" : "Entró al gimnasio",
      hora: null, reservo: false, entrada: u.hora, suelta: true,
    });
  });

  return [...filas.values()].sort((a, b) =>
    a.fecha === b.fecha
      ? (b.hora || b.entrada || "").localeCompare(a.hora || a.entrada || "")
      : b.fecha.localeCompare(a.fecha),
  );
}

/** "2026-10-08" → "jue 8/10". El día de la semana es lo que la dueña reconoce. */
function diaYFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "short", day: "numeric", month: "2-digit",
  });
}

/** El primer día del mes de hace N meses, para no traerse el historial entero. */
function mesesAtras(n: number): string {
  const [y, m] = hoyISO().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - n, 1)).toISOString().slice(0, 10);
}

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
  // Cobrar la cuota desde la ficha: registra el pago y corre el vencimiento.
  const [cobroModal, setCobroModal] = useState(false);
  const [cobroMonto, setCobroMonto] = useState("");
  const [cobroMedio, setCobroMedio] = useState("efectivo");
  const [cobrando, setCobrando] = useState(false);
  const [cobroCfg, setCobroCfg] = useState<CobroConfig | null>(null);
  /** Sucursal activa: sin esto el cobro no aparece en el dashboard. */
  const [sedeId, setSedeId] = useState<string | null>(null);
  /** A que mes corresponde la cuota que se esta cobrando. */
  const [cobroMes, setCobroMes] = useState("");
  // Venta de clase suelta (se prende en Configuracion -> Cobros).
  const [claseCfg, setClaseCfg] = useState<{ activa: boolean; precio: number | null }>({ activa: false, precio: null });
  const [claseModal, setClaseModal] = useState(false);
  const [claseMonto, setClaseMonto] = useState("");
  const [claseMedio, setClaseMedio] = useState("efectivo");
  const [claseNota, setClaseNota] = useState("");
  const [vendiendo, setVendiendo] = useState(false);
  /** Si la clase vendida le suma un cupo reservable desde su app. */
  const [claseSumaCupo, setClaseSumaCupo] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [diets, setDiets] = useState<Diet[]>([]);
  const [isElite, setIsElite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gymPlans, setGymPlans] = useState<RealPlan[]>([]);
  // Historial de clases: lo reservado, lo que entró y los horarios del gimnasio.
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [clasesGym, setClasesGym] = useState<ClaseGym[]>([]);
  const [reinicio, setReinicio] = useState<string | null>(null);
  const [verViejas, setVerViejas] = useState(false);

  // Cambio de plan
  const [planModal, setPlanModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [planMethod, setPlanMethod] = useState<PayMethod>("efectivo");
  const [savingPlan, setSavingPlan] = useState(false);

  async function load() {
    const [{ data: m }, { data: pays }, { data: rout }, { data: diet }] = await Promise.all([
      supabase.from("members").select("*").eq("id", id).single<Member>(),
      supabase.from("cashflow_entries").select("id, date, concept, amount, method, plan_name")
        .eq("member_id", id).order("date", { ascending: false }),
      supabase.from("routines").select("id, name, is_template, created_at")
        .eq("member_id", id).order("created_at", { ascending: false }),
      supabase.from("diets").select("id, name, is_template, created_at")
        .eq("member_id", id).order("created_at", { ascending: false }),
    ]);
    setMember(m ?? null);
    setPayments((pays as Payment[]) || []);
    setRoutines((rout as Routine[]) || []);
    setDiets((diet as Diet[]) || []);
    if (m?.gym_id) {
      const [{ data: sub }, { data: gym }, { data: cfg }, { data: sedes }] = await Promise.all([
        supabase.from("subscriptions").select("plan").eq("gym_id", m.gym_id).maybeSingle<{ plan: string }>(),
        supabase.from("gyms").select("real_plans, clases_reinicio").eq("id", m.gym_id)
          .maybeSingle<{ real_plans: RealPlan[]; clases_reinicio: string | null }>(),
        // Cómo cobra el negocio. Best-effort: sin migration_041 quedan los defaults.
        supabase.from("gyms").select("cobro_modo, cobro_dia, recargo_tipo, recargo_valor, clase_suelta_activa, clase_suelta_precio")
          .eq("id", m.gym_id).maybeSingle(),
        supabase.from("sedes").select("id, gym_id, name, address, created_at")
          .eq("gym_id", m.gym_id).order("created_at", { ascending: true }),
      ]);
      setSedeId(resolveActiveSede(m.gym_id, ((sedes as Sede[]) || [])));
      setIsElite(allows(await loadPlans(supabase), sub?.plan, "dietas", await loadGymExtras(supabase, m.gym_id))); // Dieta: según el plan + bonificadas
      setGymPlans(gym?.real_plans || []);
      setReinicio(gym?.clases_reinicio ?? null);

      // El historial de clases. Se filtra por gimnasio además de por socio:
      // RLS es la red, no la única barrera.
      const desde = mesesAtras(3);
      const [{ data: res }, { data: ent }, { data: cls }] = await Promise.all([
        supabase.from("bookings").select("class_id, class_date")
          .eq("gym_id", m.gym_id).eq("member_id", id).gte("class_date", desde),
        supabase.from("attendances").select("entered_at")
          .eq("gym_id", m.gym_id).eq("member_id", id).gte("entered_at", `${desde}T00:00:00-03:00`),
        supabase.from("classes").select("id, name, start_time, weekdays").eq("gym_id", m.gym_id),
      ]);
      setReservas((res as Reserva[]) || []);
      setEntradas((ent as Entrada[]) || []);
      setClasesGym((cls as ClaseGym[]) || []);
      setCobroCfg((cfg as CobroConfig) || null);
      const cf = cfg as { clase_suelta_activa?: boolean; clase_suelta_precio?: number | null } | null;
      setClaseCfg({ activa: !!cf?.clase_suelta_activa, precio: cf?.clase_suelta_precio != null ? Number(cf.clase_suelta_precio) : null });
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  function openPlanModal() {
    if (!member) return;
    setNewPlanName(member.plan_name || "");
    setNewPlanPrice(member.plan_price != null ? String(member.plan_price) : "");
    setPlanMethod("efectivo");
    setPlanModal(true);
  }
  function selectNewPlan(name: string) {
    const p = gymPlans.find((x) => x.name === name);
    setNewPlanName(name);
    if (p) setNewPlanPrice(String(p.price));
  }
  const priceDiff = newPlanPrice && member?.plan_price != null
    ? Number(newPlanPrice) - Number(member.plan_price)
    : newPlanPrice ? Number(newPlanPrice) : 0;

  async function confirmPlanChange() {
    if (!member || !newPlanName) return;
    setSavingPlan(true);
    const price = newPlanPrice ? Number(newPlanPrice) : null;
    await supabase.from("members").update({ plan_name: newPlanName, plan_price: price }).eq("id", member.id);
    if (priceDiff > 0) {
      await supabase.from("cashflow_entries").insert({
        gym_id: member.gym_id,
        sede_id: sedeId,
        member_id: member.id,
        type: "income",
        amount: priceDiff,
        method: planMethod,
        plan_name: newPlanName,
        concept: `Cambio de plan (diferencia): ${member.plan_name || "sin plan"} → ${newPlanName} · ${member.full_name}`,
        date: new Date().toISOString().slice(0, 10),
      });
    }
    setSavingPlan(false);
    setPlanModal(false);
    load();
  }

  /**
   * El precio que corresponde HOY, no el que se le guardo cuando entro.
   *
   * `members.plan_price` es una foto del dia que se le asigno el plan. Cuando
   * el negocio sube sus precios, los socios que ya estaban se quedan con el
   * viejo y al cobrar aparece el monto de antes. Le paso en DanzArte con 63
   * socias: la dueña tenia que corregir el monto a mano una por una.
   *
   * Ahora manda el precio de la lista. Si el plan ya no existe (se renombro o
   * se borro), se cae al guardado antes que dejarla sin nada.
   */
  function precioHoy(): number {
    const plan = gymPlans.find(
      (p) => p.name.trim().toLowerCase() === (member?.plan_name || "").trim().toLowerCase(),
    );
    const dePlan = Number(plan?.price) || 0;
    return dePlan > 0 ? dePlan : Number(member?.plan_price) || 0;
  }

  function abrirCobro() {
    if (!member) return;
    const base = precioHoy();
    const rec = recargoDe(base, cobroCfg, member.membership_expiry);
    setCobroMonto(base ? String(base + rec) : "");
    setCobroMes(mesQueCubre(nuevoVencimiento(member.membership_expiry, cobroCfg)));
    setCobroMedio("efectivo");
    setCobroModal(true);
  }

  /** Registra el pago Y corre el vencimiento. Las dos cosas juntas: si solo se
   *  registrara la plata, al socio le seguiría figurando "Vencido". */
  async function confirmarCobro() {
    if (!member) return;
    setCobrando(true);
    const monto = Number(cobroMonto) || 0;
    const hasta = nuevoVencimiento(member.membership_expiry, cobroCfg);

    if (monto > 0) {
    // ⚠️ NO se parte el monto en "cuota + recargo".
    //
    // Se intento inferir el recargo como "lo que pasa del precio del plan", y
    // estuvo MAL: `members.plan_price` es una foto del precio del dia que se le
    // asigno el plan, asi que cuando el negocio actualiza sus precios queda
    // viejo. En DanzArte 63 socios tenian el precio desactualizado, y al cobrar
    // el precio nuevo el sistema lo registraba como "Recargo por pago fuera de
    // termino" — un cargo que la socia nunca tuvo. Quedo a la vista de los
    // clientes y genero desconfianza.
    //
    // Un monto mayor al guardado puede ser muchas cosas: precio actualizado,
    // dos meses juntos, una correccion. No se puede adivinar cual.
    //
    // Si alguna vez hace falta separar el recargo, va con un CAMPO PROPIO en
    // el modal de cobro que el dueño completa, no deducido del monto.
    await supabase.from("cashflow_entries").insert({
      gym_id: member.gym_id,
      sede_id: sedeId,
      member_id: member.id,
      type: "income",
      amount: monto,
      method: cobroMedio,
      plan_name: member.plan_name || null,
      concept: `Cuota ${nombreMes(cobroMes)} — ${member.full_name.trim()}`,
      date: hoyISO(),
    });
    }
    // Los cupos extra NO se tocan al renovar: se acumulan hasta que los use.
    // Si compró una clase suelta y no llegó a usarla, la conserva.
    await supabase.from("members")
      .update({ membership_expiry: hasta })
      .eq("id", member.id);
    setCobrando(false);
    setCobroModal(false);
    load();
  }

  function abrirClase() {
    setClaseMonto(claseCfg.precio != null ? String(claseCfg.precio) : "");
    setClaseMedio("efectivo"); setClaseNota("");
    setClaseSumaCupo(true);
    setClaseModal(true);
  }

  /** Vende una clase suelta. NO le toca el vencimiento: es una clase extra, no
   *  una cuota. Sirve tanto para el que esta al dia como para el que debe. */
  async function confirmarClase() {
    if (!member) return;
    const monto = Number(claseMonto) || 0;
    if (monto <= 0) return;
    setVendiendo(true);
    await supabase.from("cashflow_entries").insert({
      gym_id: member.gym_id,
      sede_id: sedeId,
      member_id: member.id,
      type: "income",
      amount: monto,
      method: claseMedio,
      concept: `Clase suelta — ${member.full_name.trim()}${claseNota.trim() ? ` (${claseNota.trim()})` : ""}${claseSumaCupo ? "" : " · sin cupo"}`,
      date: hoyISO(),
    });
    // El cupo extra le permite reservarla desde su app. Si es la clase de hoy
    // y ya está en la puerta, no hace falta: solo se registra la plata.
    if (claseSumaCupo) {
      await supabase.from("members")
        .update({ clases_extra: (Number(member.clases_extra) || 0) + 1 })
        .eq("id", member.id);
    }
    setVendiendo(false);
    setClaseModal(false);
    load();
  }

  if (loading) return <main className="p-8 text-center text-ink-2">Cargando…</main>;
  if (!member) return (
    <main className="mx-auto max-w-3xl px-6 py-8 text-center">
      <p className="text-ink-2">No se encontró el socio.</p>
      <Link href="/dashboard/socios" className="mt-3 inline-block text-brand hover:underline">← Volver a Socios</Link>
    </main>
  );

  const st = statusOf(member.membership_expiry);
  const totalPagado = payments.reduce((s, p) => s + Number(p.amount), 0);

  const filasClases = useMemo(
    () => historialDeClases(reservas, entradas, clasesGym),
    [reservas, entradas, clasesGym],
  );

  /**
   * El ciclo que corre hoy y cuántas clases van.
   *
   * ⚠️ Usa el MISMO `cicloDe` y el MISMO tope que la lista de socios, la app
   * del socio y el trigger de la base. Si no dieran igual, la dueña ve un
   * número y la socia otro — que es justo el problema que esto vino a
   * resolver. Los cupos extra (clases sueltas vendidas) suben el tope, igual
   * que en el trigger de migration_043.
   */
  const cupo = useMemo(() => {
    if (!member) return null;
    const ultimoPago = payments.find((p) => /^cuota /i.test((p.concept || "").trim()))?.date;
    const { ini, fin } = cicloDe(hoyISO(), member.membership_expiry, ultimoPago ?? null, reinicio);
    const base = topeDelPlan(gymPlans, member.plan_name);
    const limite = base === null ? null : base + (Number(member.clases_extra) || 0);
    const usadas = reservas.filter((r) => {
      const f = String(r.class_date).slice(0, 10);
      return f > ini && f <= fin;
    }).length;
    return { ini, fin, limite, usadas };
  }, [member, payments, reservas, gymPlans, reinicio]);

  const delCiclo = cupo ? filasClases.filter((f) => f.fecha > cupo.ini && f.fecha <= cupo.fin) : filasClases;
  const viejas = cupo ? filasClases.filter((f) => !(f.fecha > cupo.ini && f.fecha <= cupo.fin)) : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
          <Link href="/dashboard" className="hover:text-brand">Panel</Link>
          <span>/</span>
          <Link href="/dashboard/socios" className="hover:text-brand">Socios</Link>
          <span>/</span><span>{member.full_name}</span>
        </div>
        <h1 className="text-2xl font-bold">
          {member.full_name}
          {member.member_number != null && <span className="ml-2 text-base font-normal text-muted">N° {member.member_number}</span>}
        </h1>
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
            {(Number(member.clases_extra) || 0) > 0 && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-good/30 bg-[rgba(34,197,94,.08)] px-2 py-0.5 text-[11px] font-semibold text-good">
                +{member.clases_extra} clase{Number(member.clases_extra) === 1 ? "" : "s"} suelta{Number(member.clases_extra) === 1 ? "" : "s"} para reservar
              </div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Vencimiento</div>
            <div className="mt-1 flex items-center gap-2">
              <span>{member.membership_expiry ? new Date(member.membership_expiry + "T00:00:00").toLocaleDateString("es-AR") : "—"}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Altura</div>
            <div className="mt-0.5">{member.height_cm ? `${member.height_cm} cm` : "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Fecha de alta</div>
            <div className="mt-0.5">{member.created_at ? new Date(member.created_at).toLocaleDateString("es-AR") : "—"}</div>
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
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary text-sm" onClick={abrirCobro}>💵 Cobrar cuota</button>
          {claseCfg.activa && (
            <button className="btn btn-ghost text-sm" onClick={abrirClase}>🎟️ Vender clase suelta</button>
          )}
          <Link href="/dashboard/socios" className="btn btn-ghost text-sm">✏️ Editar en Socios</Link>
          <button className="btn btn-ghost text-sm" onClick={openPlanModal}>🔄 Cambiar plan</button>
        </div>
      </div>

      {/* CLASES DEL CICLO */}
      <div className="card mb-6 p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
          <div>
            <span className="text-sm font-semibold">Clases</span>
            {cupo && (
              <span className="ml-2 text-xs text-muted">
                del {diaYFecha(cupo.ini)} al {diaYFecha(cupo.fin)}
              </span>
            )}
          </div>
          {cupo?.limite != null ? (
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              cupo.usadas >= cupo.limite
                ? "bg-[rgba(240,82,82,.14)] text-[#f87171]"
                : cupo.limite - cupo.usadas <= 2
                  ? "bg-[rgba(245,177,61,.14)] text-[#f5b13d]"
                  : "bg-[rgba(34,197,94,.14)] text-[#4ade80]"
            }`}>
              {cupo.usadas} de {cupo.limite} usadas · {cupo.usadas >= cupo.limite
                ? "sin cupo"
                : `le ${cupo.limite - cupo.usadas === 1 ? "queda" : "quedan"} ${cupo.limite - cupo.usadas}`}
            </span>
          ) : (
            <span className="text-xs text-muted">Plan sin tope de clases</span>
          )}
        </div>

        {delCiclo.length === 0 ? (
          <p className="p-8 text-center text-ink-2">
            Todavía no reservó ni vino a ninguna clase en este período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 pb-3 pt-1">Día</th>
                  <th className="px-4 pb-3 pt-1">Clase</th>
                  <th className="px-4 pb-3 pt-1">Se anotó</th>
                  <th className="px-4 pb-3 pt-1">Vino</th>
                </tr>
              </thead>
              <tbody>
                {delCiclo.map((f) => <FilaDeClase key={f.clave} f={f} />)}
                {verViejas && viejas.length > 0 && (
                  <>
                    <tr className="border-t border-white/10">
                      <td colSpan={4} className="bg-white/[.03] px-4 py-2 text-xs uppercase tracking-wide text-muted">
                        Períodos anteriores
                      </td>
                    </tr>
                    {viejas.map((f) => <FilaDeClase key={f.clave} f={f} vieja />)}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-3">
          <p className="text-[11px] leading-snug text-muted">
            El cupo cuenta las <b>reservas</b>: la clase que reservó y no canceló a
            tiempo se le descuenta igual, haya venido o no. Quién vino se deduce del
            control de acceso por el horario de entrada.
          </p>
          {viejas.length > 0 && (
            <button className="btn btn-ghost shrink-0 text-xs" onClick={() => setVerViejas((v) => !v)}>
              {verViejas ? "Ocultar anteriores" : `Ver ${viejas.length} de períodos anteriores`}
            </button>
          )}
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
      <div className="card mb-6 p-0">
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

      {/* DIETA ASIGNADA (planes Pro y Elite) */}
      {isElite && (
        <div className="card p-0">
          <div className="border-b border-white/10 p-4 text-sm font-semibold">Dieta asignada</div>
          {diets.length === 0 ? (
            <p className="p-8 text-center text-ink-2">
              Este socio todavía no tiene una dieta asignada. Andá a{" "}
              <Link href="/dashboard/dietas" className="text-brand">Dietas</Link> para aplicarle una plantilla.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {diets.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-4 py-3">
                  <span>{d.name || "Dieta sin nombre"}</span>
                  <Link href="/dashboard/dietas" className="text-sm text-brand hover:underline">Ver / editar →</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* MODAL: CAMBIAR PLAN */}
      {/* Cobrar la cuota: registra el pago y corre el vencimiento de una vez. */}
      {cobroModal && member && (() => {
        const hasta = nuevoVencimiento(member.membership_expiry, cobroCfg);
        const rec = recargoDe(precioHoy(), cobroCfg, member.membership_expiry);
        return (
          <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setCobroModal(false)}>
            <div className="card my-auto w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-1 text-lg font-bold">Cobrar cuota</h3>
              <p className="mb-4 text-sm text-ink-2">{member.full_name}{member.plan_name ? ` · ${member.plan_name.trim()}` : ""}</p>

              <div className="mb-3 rounded-lg border border-good/30 bg-[rgba(34,197,94,.08)] px-3 py-2 text-sm text-good">
                Le va a vencer el <b>{fechaCorta(hasta)}</b>
                {member.membership_expiry && member.membership_expiry > hoyISO()
                  ? <span className="text-ink-2"> (se le suma un mes a lo que ya tenía)</span>
                  : <span className="text-ink-2"> (estaba vencido, se cuenta desde hoy)</span>}
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs text-ink-2">¿A qué mes corresponde?</label>
                <select className="input" value={cobroMes} onChange={(e) => setCobroMes(e.target.value)}>
                  {mesesOpciones(hoyISO()).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-muted">Queda anotado en el historial de pagos, para saber qué mes pagó.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-ink-2">Monto ($)</label>
                  <input className="input" type="number" value={cobroMonto} onChange={(e) => setCobroMonto(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-2">Medio de pago</label>
                  <select className="input" value={cobroMedio} onChange={(e) => setCobroMedio(e.target.value)}>
                    {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              {rec > 0 && (
                <p className="mt-1.5 text-[11px] text-warn">⚠ Está atrasado: se le sumó un recargo de ${rec.toLocaleString("es-AR")}. Podés cambiar el monto.</p>
              )}
              <p className="mt-1.5 text-[11px] text-muted">Si ponés 0 no se registra el movimiento en la caja, pero igual se renueva el vencimiento.</p>

              <div className="mt-4 flex gap-2">
                <button className="btn btn-primary flex-1" onClick={confirmarCobro} disabled={cobrando}>
                  {cobrando ? "Guardando…" : "Cobrar y renovar"}
                </button>
                <button className="btn btn-ghost" onClick={() => setCobroModal(false)} disabled={cobrando}>Cancelar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Venta de clase suelta: trae el precio configurado pero se puede pisar. */}
      {claseModal && member && (
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setClaseModal(false)}>
          <div className="card my-auto w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold">Vender clase suelta</h3>
            <p className="mb-4 text-sm text-ink-2">{member.full_name.trim()}</p>

            <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink-2">
              Es una clase extra: <b className="text-ink">no le mueve el vencimiento</b>. Sirve igual si está al día o si debe.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-2">Monto ($)</label>
                <input className="input" type="number" value={claseMonto} onChange={(e) => setClaseMonto(e.target.value)} placeholder="0" />
                {claseCfg.precio != null && Number(claseMonto) !== claseCfg.precio && (
                  <p className="mt-1 text-[11px] text-warn">Distinto al configurado (${claseCfg.precio.toLocaleString("es-AR")}).</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-2">Medio de pago</label>
                <select className="input" value={claseMedio} onChange={(e) => setClaseMedio(e.target.value)}>
                  {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold text-ink-2">¿Se la sumás a sus cupos?</div>
              {([
                [true, "Sí, que la reserve él", "Le queda un cupo extra que no vence: lo usa cuando quiera, aunque le renueves la cuota."],
                [false, "No, es para hoy", "Solo se registra la plata. Ya está acá, no va a reservar nada por la web."],
              ] as [boolean, string, string][]).map(([v, titulo, desc]) => (
                <label key={String(v)}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition ${
                    claseSumaCupo === v ? "border-brand bg-[rgba(34,211,238,.07)]" : "border-white/10 hover:border-white/20"
                  }`}>
                  <input type="radio" className="mt-0.5" checked={claseSumaCupo === v} onChange={() => setClaseSumaCupo(v)} />
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${claseSumaCupo === v ? "text-brand" : "text-ink"}`}>{titulo}</span>
                    <span className="block text-[11px] leading-snug text-muted">{desc}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-xs text-ink-2">Aclaración (opcional)</label>
              <input className="input" value={claseNota} onChange={(e) => setClaseNota(e.target.value)} placeholder="Ej: Zumba del jueves" />
            </div>

            <div className="mt-4 flex gap-2">
              <button className="btn btn-primary flex-1" onClick={confirmarClase} disabled={vendiendo || !(Number(claseMonto) > 0)}>
                {vendiendo ? "Guardando…" : "Registrar venta"}
              </button>
              <button className="btn btn-ghost" onClick={() => setClaseModal(false)} disabled={vendiendo}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {planModal && (
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setPlanModal(false)}>
          <div className="card my-auto w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold">Cambiar plan</h3>
            <p className="mb-4 text-sm text-ink-2">
              Plan actual: <strong>{member.plan_name || "sin plan"}</strong>{member.plan_price ? ` · ${money(member.plan_price)}` : ""}
            </p>
            <div className="flex flex-col gap-3">
              {gymPlans.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs text-ink-2">Nuevo plan</label>
                  <select className="input" value={gymPlans.some((p) => p.name === newPlanName) ? newPlanName : "__custom"}
                    onChange={(e) => { if (e.target.value === "__custom") setNewPlanName(""); else selectNewPlan(e.target.value); }}>
                    <option value="">Seleccioná un plan…</option>
                    {gymPlans.map((p) => <option key={p.name} value={p.name}>{p.name} — ${p.price}</option>)}
                    <option value="__custom">Otro / personalizado</option>
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Nombre del plan" value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} />
                <input className="input" type="number" placeholder="Precio ($)" value={newPlanPrice} onChange={(e) => setNewPlanPrice(e.target.value)} />
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                {priceDiff > 0 ? (
                  <>
                    <div className="font-semibold text-good">Diferencia a cobrar: {money(priceDiff)}</div>
                    <label className="mt-2 mb-1 block text-xs text-ink-2">Medio de pago</label>
                    <select className="input" value={planMethod} onChange={(e) => setPlanMethod(e.target.value as PayMethod)}>
                      {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </>
                ) : priceDiff < 0 ? (
                  <div className="text-ink-2">Este plan es más barato que el actual — no se registra ningún cobro. Diferencia: {money(Math.abs(priceDiff))}</div>
                ) : (
                  <div className="text-ink-2">Sin diferencia de precio.</div>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setPlanModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmPlanChange} disabled={savingPlan || !newPlanName}>
                {savingPlan ? "Guardando…" : priceDiff > 0 ? `Confirmar y cobrar ${money(priceDiff)}` : "Confirmar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* El simulador de resultados. Acá es el momento de la VENTA: la persona
          está en el mostrador y el dueño le muestra a dónde puede llegar.
          No se dibuja nada si el plan no lo incluye. */}
      <div className="mt-6">
        <SimuladorResultado memberId={id} />
      </div>
    </main>
  );
}

/**
 * Una fila del historial de clases.
 *
 * "No figura" y no "No vino" a propósito: el sistema sabe que no quedó
 * registrada la entrada, no que la persona faltó. Puede haber entrado fuera
 * del horario de la clase o que ese día no se haya marcado. Si esto se usa
 * para discutir con una socia, el texto tiene que decir exactamente lo que
 * el sistema sabe.
 */
function FilaDeClase({ f, vieja }: { f: FilaClase; vieja?: boolean }) {
  const hoy = hoyISO();
  return (
    <tr className={`border-t border-white/10 ${vieja ? "opacity-60" : ""}`}>
      <td className="whitespace-nowrap px-4 py-3 text-ink-2">{diaYFecha(f.fecha)}</td>
      <td className="px-4 py-3">
        {f.clase}
        {f.hora && <span className="ml-1 text-muted">{f.hora}</span>}
      </td>
      <td className="px-4 py-3">
        {f.reservo ? (
          <span className="text-ink-2">Sí</span>
        ) : f.suelta ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="text-[#f5b13d]" title="No reservó, pero el control de acceso la registró">
            No, vino igual
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {f.entrada ? (
          <span className="text-good">Sí, {f.entrada}</span>
        ) : f.fecha > hoy ? (
          <span className="text-muted">Es más adelante</span>
        ) : f.fecha === hoy ? (
          <span className="text-muted">Todavía no</span>
        ) : (
          <span className="text-muted" title="No quedó registrada su entrada ese día">No figura</span>
        )}
      </td>
    </tr>
  );
}
