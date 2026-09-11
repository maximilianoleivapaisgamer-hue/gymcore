"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

/**
 * Aviso arriba del panel cuando al dueño se le está por vencer el abono.
 *
 * El vencimiento se veía solo entrando a "Mi plan", que es una pantalla que
 * nadie abre salvo que la busque. Acá aparece donde sí entra todos los días, y
 * el botón lo deja parado en el bloque de pago.
 *
 * No se le muestra a quien no tiene nada que pagar: ni al bonificado, ni al que
 * tiene débito automático (a ese se le cobra solo), ni a los empleados.
 */

/** Con cuántos días de anticipación avisamos. */
const DIAS_AVISO = 7;

interface Sub {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  payment_method: string | null;
  mp_preapproval_id: string | null;
}

/** Días hasta esa fecha, leyendo el texto y sin husos de por medio. */
function diasPara(s: string | null): number | null {
  if (!s) return null;
  const [a, m, d] = String(s).slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return null;
  const hoy = new Date();
  return Math.round(
    (new Date(a, m - 1, d).getTime() -
      new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000,
  );
}

function fecha(s: string | null): string {
  if (!s) return "";
  const [a, m, d] = String(s).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}` : "";
}

export default function AvisoAbono() {
  const supabase = createClient();
  const [dias, setDias] = useState<number | null>(null);
  const [vence, setVence] = useState<string | null>(null);
  const [esPrueba, setEsPrueba] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: perfil } = await supabase
        .from("profiles").select("gym_id, role").eq("id", user.id)
        .single<{ gym_id: string | null; role: string }>();
      // El abono con turnogym es asunto del dueño, no de su equipo.
      if (!perfil?.gym_id || perfil.role === "empleado") return;

      const { data } = await supabase
        .from("subscriptions")
        .select("plan, status, trial_ends_at, current_period_end, payment_method, mp_preapproval_id")
        .eq("gym_id", perfil.gym_id).maybeSingle<Sub>();
      if (!data) return;
      if (data.status !== "active" && data.status !== "trial" && data.status !== "past_due") return;

      // Bonificado o con débito automático: no tiene que hacer nada.
      if (data.payment_method === "gratis") return;
      if (data.payment_method === "mercadopago" && data.mp_preapproval_id) return;

      const f = data.status === "trial" ? data.trial_ends_at : data.current_period_end;
      const d = diasPara(f);
      if (d === null || d > DIAS_AVISO) return;

      setEsPrueba(data.status === "trial");
      setVence(f);
      setDias(d);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (dias === null) return null;

  const vencido = dias < 0;

  return (
    <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
      vencido
        ? "border-crit/30 bg-[rgba(240,82,82,.08)]"
        : "border-[#f5b13d]/30 bg-[rgba(245,177,61,.1)]"
    }`}>
      <div className="min-w-0">
        <div className={`text-sm font-semibold ${vencido ? "text-crit" : "text-[#f5b13d]"}`}>
          {vencido
            ? `Tu abono con turnogym venció el ${fecha(vence)}.`
            : dias === 0
              ? `Tu ${esPrueba ? "prueba termina" : "abono vence"} hoy.`
              : `Tu ${esPrueba ? "prueba termina" : "abono vence"} en ${dias} ${dias === 1 ? "día" : "días"}, el ${fecha(vence)}.`}
        </div>
        <p className="text-xs text-ink-2">
          {esPrueba
            ? "Aboná para seguir usando el sistema sin cortes."
            : "Aboná el mes para que no se te corte el servicio."}
        </p>
      </div>
      <Link href="/dashboard/mi-plan#abonar" className="btn btn-primary shrink-0 text-xs">
        Pagar ahora
      </Link>
    </div>
  );
}
