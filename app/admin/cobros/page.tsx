"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { loadPlans, type PlanConfig } from "@/lib/plans";
import { money } from "@/lib/admin";

interface Settings {
  transfer_alias: string | null;
  transfer_cbu: string | null;
  transfer_holder: string | null;
  transfer_note: string | null;
  convert_clear_sample: boolean;
}

export default function CobrosPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [mp, setMp] = useState(false);
  const [appUrl, setAppUrl] = useState("");
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [s, setS] = useState<Settings>({ transfer_alias: "", transfer_cbu: "", transfer_holder: "", transfer_note: "", convert_clear_sample: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [res, pl] = await Promise.all([
        fetch("/api/admin/cobros").then((r) => r.json()).catch(() => null),
        loadPlans(supabase),
      ]);
      setPlans(pl);
      if (res?.ok) {
        setMp(!!res.mp);
        setAppUrl(res.appUrl || "");
        if (res.settings) {
          setS({
            transfer_alias: res.settings.transfer_alias || "",
            transfer_cbu: res.settings.transfer_cbu || "",
            transfer_holder: res.settings.transfer_holder || "",
            transfer_note: res.settings.transfer_note || "",
            convert_clear_sample: res.settings.convert_clear_sample ?? true,
          });
        }
      }
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  function set<K extends keyof Settings>(k: K, v: Settings[K]) { setS((p) => ({ ...p, [k]: v })); }

  async function save() {
    setSaving(true); setMsg("");
    const res = await fetch("/api/admin/cobros", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(s),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    setMsg(res?.ok ? "Guardado ✓" : `No se pudo guardar${res?.error ? ` (${res.error})` : ""}`);
  }

  if (loading) return <div className="grid min-h-[50vh] place-items-center text-ink-2">Cargando…</div>;

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Cobros</h1>
          <p className="mt-1 text-ink-2">Configurá cómo cobrás el abono a los gimnasios.</p>
        </div>
        {msg && <span className="text-sm text-brand">{msg}</span>}
      </div>

      {/* Estado de las pasarelas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`card ${mp ? "border-good/30" : "border-warn/30"}`}>
          <div className="flex items-center justify-between">
            <b>💳 Mercado Pago</b>
            {mp ? (
              <span className="rounded-full bg-[rgba(34,197,94,.14)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-good">Activo</span>
            ) : (
              <span className="rounded-full bg-[rgba(245,177,61,.14)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-warn">Falta token</span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-2">
            Suscripción con débito automático mensual (ARS). El dueño cambia su plan desde “Mi Plan”, paga, y el estado
            se actualiza solo por webhook.
          </p>
          {!mp && (
            <p className="mt-2 rounded-lg border border-warn/25 bg-[rgba(245,177,61,.06)] p-2 text-[11px] text-warn">
              Para activarlo, cargá <b>MP_ACCESS_TOKEN</b> en Vercel (Settings → Environment Variables) y volvé a desplegar.
              Por seguridad, el token no se configura desde acá.
            </p>
          )}
          {!appUrl && (
            <p className="mt-2 text-[11px] text-muted">
              Recordá cargar también <b>NEXT_PUBLIC_APP_URL</b> = https://turnogym.com para que los links de pago vuelvan bien.
            </p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <b>🏦 Transferencia</b>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-ink-2">Manual</span>
          </div>
          <p className="mt-1 text-xs text-ink-2">
            Para los que te pagan por transferencia. Cargá acá tus datos y, cuando registres el pago en el Dashboard,
            marcá el método como “Transferencia”.
          </p>
        </div>
      </div>

      {/* Datos de transferencia */}
      <div className="mt-6 card">
        <h2 className="font-semibold">Tus datos para transferencias</h2>
        <p className="mt-1 text-sm text-ink-2">Estos datos los usás para pasárselos a los gimnasios que pagan por transferencia.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink-2">Alias</span>
            <input className="input" value={s.transfer_alias ?? ""} onChange={(e) => set("transfer_alias", e.target.value)} placeholder="turnogym.mp" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink-2">Titular de la cuenta</span>
            <input className="input" value={s.transfer_holder ?? ""} onChange={(e) => set("transfer_holder", e.target.value)} placeholder="Maximiliano Leiva" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-semibold text-ink-2">CBU / CVU</span>
            <input className="input" value={s.transfer_cbu ?? ""} onChange={(e) => set("transfer_cbu", e.target.value)} placeholder="0000003100000000000000" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-semibold text-ink-2">Nota (opcional)</span>
            <input className="input" value={s.transfer_note ?? ""} onChange={(e) => set("transfer_note", e.target.value)} placeholder="Enviá el comprobante por WhatsApp." />
          </label>
        </div>
      </div>

      {/* Conversión de demos */}
      <div className="mt-6 card">
        <h2 className="font-semibold">Al convertir una demo en cliente</h2>
        <label className="mt-3 flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={s.convert_clear_sample} onChange={(e) => set("convert_clear_sample", e.target.checked)} />
          <span className="text-sm">
            <b>Limpiar los datos de ejemplo</b> (socios, caja, rutinas y dietas de muestra).
            <span className="block text-xs text-ink-2">Se mantiene la web, la marca, las clases y las sedes. Recomendado: así el cliente arranca con su cuenta limpia.</span>
          </span>
        </label>
      </div>

      {/* Precios */}
      <div className="mt-6 card">
        <h2 className="font-semibold">Precios de los planes</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {plans.map((p) => (
            <div key={p.key} className="rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-sm">
              <span className="font-semibold">{p.label}</span> · <span className="text-brand">{money(p.price)}</span>/mes
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">Editá los precios desde el módulo <b>Planes</b>.</p>
      </div>

      <div className="mt-6 flex justify-end">
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar cambios"}</button>
      </div>
    </div>
  );
}
