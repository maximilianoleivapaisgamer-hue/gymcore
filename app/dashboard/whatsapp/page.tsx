"use client";

import { useEffect, useState } from "react";

export default function WhatsAppPage() {
  const [loading, setLoading] = useState(true);
  const [central, setCentral] = useState(false);
  const [gymName, setGymName] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [daysBefore, setDaysBefore] = useState(3);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testErr, setTestErr] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/whatsapp").then((x) => x.json()).catch(() => null);
      if (r?.ok) { setCentral(r.central); setGymName(r.gymName); setPhoneId(r.phoneId); setEnabled(r.enabled); setDaysBefore(r.daysBefore); }
      setLoading(false);
    })();
  }, []);

  async function guardar() {
    setErr(""); setMsg(""); setSaving(true);
    const r = await fetch("/api/whatsapp", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", phoneId, enabled, daysBefore }),
    }).then((x) => x.json()).catch(() => null);
    setSaving(false);
    if (r?.ok) setMsg("Guardado."); else setErr(r?.error || "No se pudo guardar.");
  }

  async function enviarPrueba() {
    setTestErr(""); setTestMsg("");
    if (!testTo.trim()) { setTestErr("Escribí un número (con código de área)."); return; }
    setTestBusy(true);
    const r = await fetch("/api/whatsapp", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "test", to: testTo.trim() }),
    }).then((x) => x.json()).catch(() => null);
    setTestBusy(false);
    if (r?.ok) setTestMsg("¡Enviado! Revisá el WhatsApp de ese número."); else setTestErr(r?.error || "No se pudo enviar la prueba.");
  }

  if (loading) return <div className="grid min-h-[40vh] place-items-center text-ink-2">Cargando…</div>;

  return (
    <div className="mx-auto w-full max-w-2xl p-5 md:p-7">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Recordatorios por WhatsApp</h1>
        <p className="mt-1 text-ink-2">Avisá automáticamente a los socios que tienen la cuota por vencer o vencida, desde el número de tu gimnasio.</p>
      </div>

      {!central && (
        <div className="card mb-4 border-warn/30 bg-[rgba(245,177,61,.06)]">
          <p className="text-sm text-warn">⚠️ WhatsApp todavía no está habilitado en la plataforma. Escribinos para activarlo en tu cuenta.</p>
        </div>
      )}

      <div className="card mb-4">
        <label className="mb-1 block text-sm font-semibold">Número de WhatsApp del gimnasio</label>
        <p className="mb-2 text-xs text-ink-2">Es el identificador del número (phone number ID) que te da turnogym al conectar el WhatsApp de <b>{gymName || "tu gimnasio"}</b>. Si no lo tenés, te lo pasamos nosotros.</p>
        <input className="input" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="phone number ID (ej: 123456789012345)" />
      </div>

      <div className="card mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Recordatorios automáticos</div>
            <p className="text-xs text-ink-2">Cuando está activado, el sistema avisa solo a los que deben.</p>
          </div>
          <button type="button" onClick={() => setEnabled((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-brand" : "bg-white/15"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-6" : "left-1"}`} />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-ink-2">Avisar</span>
          <input type="number" min={0} max={30} value={daysBefore} onChange={(e) => setDaysBefore(Number(e.target.value))} className="input w-20 text-center" />
          <span className="text-ink-2">días antes del vencimiento (y si sigue impaga, cuando vence).</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</button>
        {msg && <span className="text-sm text-good">{msg}</span>}
        {err && <span className="text-sm text-crit">{err}</span>}
      </div>

      {/* Prueba */}
      <div className="card mt-6">
        <div className="mb-1 text-sm font-semibold">Enviar una prueba</div>
        <p className="mb-3 text-xs text-ink-2">Mandate el recordatorio a tu propio número para ver cómo llega (con código de área, ej: 1150000000).</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="input flex-1" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Tu número de WhatsApp" />
          <button className="btn btn-ghost shrink-0" onClick={enviarPrueba} disabled={testBusy}>{testBusy ? "Enviando…" : "Enviar prueba"}</button>
        </div>
        {testMsg && <p className="mt-2 text-sm text-good">{testMsg}</p>}
        {testErr && <p className="mt-2 text-sm text-crit">{testErr}</p>}
      </div>
    </div>
  );
}
