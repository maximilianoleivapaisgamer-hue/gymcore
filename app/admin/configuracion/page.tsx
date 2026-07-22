"use client";

import { useEffect, useState } from "react";

interface Cfg {
  apify: { hasToken: boolean; masked: string | null; hasEnv: boolean };
  google: { hasKey: boolean; masked: string | null };
  provider: "apify" | "google";
  googleCount: number;
  mes: string;
}
interface Bal {
  apify: { usedUsd: number | null; limitUsd: number | null; remainingUsd: number | null } | null;
  apifyReadable: boolean;
  google: { hasKey: boolean; count: number; estUsd: number };
  mes: string;
}

const usd = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

async function call(action: string, extra: Record<string, unknown> = {}) {
  return fetch("/api/admin/config", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  }).then((x) => x.json()).catch(() => null);
}

export default function ConfiguracionPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [bal, setBal] = useState<Bal | null>(null);
  const [loading, setLoading] = useState(true);

  const [apifyInput, setApifyInput] = useState("");
  const [googleInput, setGoogleInput] = useState("");
  const [reveal, setReveal] = useState<{ apifyToken: string | null; googleKey: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [balBusy, setBalBusy] = useState(false);

  async function refresh() {
    const r = await call("get");
    if (r?.ok) setCfg(r);
  }
  async function refreshBalance() {
    setBalBusy(true);
    const r = await call("balance");
    if (r?.ok) setBal(r);
    setBalBusy(false);
  }
  useEffect(() => {
    (async () => { await refresh(); await refreshBalance(); setLoading(false); })();
  }, []);

  async function verSecretos() {
    if (reveal) { setReveal(null); return; }
    const r = await call("reveal");
    if (r?.ok) setReveal({ apifyToken: r.apifyToken, googleKey: r.googleKey });
  }

  async function guardarApify() {
    const t = apifyInput.trim();
    if (t.length < 20) { alert("Pegá el token completo de Apify."); return; }
    setBusy(true); const r = await call("set_apify", { token: t }); setBusy(false);
    if (r?.ok) { setCfg(r); setApifyInput(""); setReveal(null); refreshBalance(); } else alert(r?.error || "No se pudo guardar.");
  }
  async function borrarApify() {
    if (!confirm("¿Borrar el token de Apify guardado y volver al de Vercel?")) return;
    setBusy(true); const r = await call("clear_apify"); setBusy(false);
    if (r?.ok) { setCfg(r); setReveal(null); refreshBalance(); }
  }
  async function guardarGoogle() {
    const k = googleInput.trim();
    if (k.length < 20) { alert("Pegá la API key completa de Google."); return; }
    setBusy(true); const r = await call("set_google", { key: k }); setBusy(false);
    if (r?.ok) { setCfg(r); setGoogleInput(""); setReveal(null); refreshBalance(); } else alert(r?.error || "No se pudo guardar.");
  }
  async function borrarGoogle() {
    if (!confirm("¿Borrar la API key de Google guardada?")) return;
    setBusy(true); const r = await call("clear_google"); setBusy(false);
    if (r?.ok) { setCfg(r); setReveal(null); refreshBalance(); }
  }
  async function cambiarProveedor(p: "apify" | "google") {
    setBusy(true); const r = await call("set_provider", { provider: p }); setBusy(false);
    if (r?.ok) setCfg(r);
  }

  if (loading) return <div className="grid min-h-[40vh] place-items-center text-ink-2">Cargando…</div>;

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="mt-1 text-ink-2">Tokens de búsqueda para el generador de demos y sus saldos.</p>
        </div>
        <button onClick={verSecretos} className="shrink-0 rounded-lg border border-white/[.08] px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink">
          {reveal ? "🙈 Ocultar tokens" : "👁️ Ver tokens"}
        </button>
      </div>

      {/* Proveedor activo */}
      <div className="card mb-4">
        <div className="text-sm font-semibold">Proveedor de búsqueda</div>
        <p className="mt-1 text-xs text-ink-2">Con cuál se busca el gimnasio en el generador. Si al elegido se le acaban los créditos, cambiá al otro.</p>
        <div className="mt-3 flex gap-2">
          {(([["apify", "Apify"], ["google", "Google Places"]] as const)).map(([k, label]) => (
            <button key={k} onClick={() => cambiarProveedor(k)} disabled={busy}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${cfg?.provider === k ? "border-brand/40 bg-[rgba(34,211,238,.12)] text-brand" : "border-white/10 text-ink-2 hover:text-ink"}`}>
              {label}{cfg?.provider === k ? " ✓" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* APIFY */}
      <div className="card mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">🕷️ Apify</div>
          <span className="text-[11px] text-muted">
            {cfg?.apify.hasToken ? <>token guardado: <b className="text-good">{cfg.apify.masked}</b></> : cfg?.apify.hasEnv ? "usando el de Vercel" : <b className="text-crit">sin token</b>}
          </span>
        </div>
        {reveal && cfg?.apify.hasToken && (
          <div className="mt-2 break-all rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-ink">{reveal.apifyToken}</div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className="input h-9 flex-1 py-0 text-sm" type={reveal ? "text" : "password"} value={apifyInput}
            onChange={(e) => setApifyInput(e.target.value)} placeholder="Pegá un token nuevo (apify_api_…)" />
          <button className="btn btn-primary text-xs" onClick={guardarApify} disabled={busy}>Guardar</button>
          {cfg?.apify.hasToken && <button className="text-[11px] text-muted hover:text-crit" onClick={borrarApify} disabled={busy}>Borrar</button>}
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs">
          <div className="font-semibold text-ink-2">Saldo (mes en curso)</div>
          {bal?.apify ? (
            <div className="mt-1 grid grid-cols-3 gap-2 text-center">
              <div><div className="text-muted text-[10px]">Usado</div><div className="font-bold">{usd(bal.apify.usedUsd)}</div></div>
              <div><div className="text-muted text-[10px]">Límite</div><div className="font-bold">{usd(bal.apify.limitUsd)}</div></div>
              <div><div className="text-muted text-[10px]">Restante</div><div className="font-bold text-good">{usd(bal.apify.remainingUsd)}</div></div>
            </div>
          ) : (
            <p className="mt-1 text-muted">{bal?.apifyReadable ? "No se pudo leer el saldo (revisá el token)." : "Cargá un token para ver el saldo."}</p>
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted">Token en Apify → Settings → Integrations → API token. Se guarda protegido; solo lo lee el servidor.</p>
      </div>

      {/* GOOGLE */}
      <div className="card mb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">🗺️ Google Places</div>
          <span className="text-[11px] text-muted">
            {cfg?.google.hasKey ? <>key guardada: <b className="text-good">{cfg.google.masked}</b></> : <b className="text-crit">sin conectar</b>}
          </span>
        </div>
        {reveal && cfg?.google.hasKey && (
          <div className="mt-2 break-all rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-ink">{reveal.googleKey}</div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input className="input h-9 flex-1 py-0 text-sm" type={reveal ? "text" : "password"} value={googleInput}
            onChange={(e) => setGoogleInput(e.target.value)} placeholder="Pegá la API key de Google (AIza…)" />
          <button className="btn btn-primary text-xs" onClick={guardarGoogle} disabled={busy}>Conectar</button>
          {cfg?.google.hasKey && <button className="text-[11px] text-muted hover:text-crit" onClick={borrarGoogle} disabled={busy}>Borrar</button>}
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-xs">
          <div className="font-semibold text-ink-2">Uso de Google ({bal?.mes})</div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <div>
              <div className="text-lg font-bold">{bal?.google.count ?? 0} <span className="text-xs font-normal text-muted">búsquedas</span></div>
              <div className="text-[11px] text-muted">≈ {usd(bal?.google.estUsd ?? 0)} estimado este mes</div>
            </div>
            <a href="https://console.cloud.google.com/billing" target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-brand/30 bg-[rgba(34,211,238,.08)] px-2.5 py-1 text-[11px] font-semibold text-brand hover:bg-[rgba(34,211,238,.16)]">
              Ver crédito real en Google →
            </a>
          </div>
          <p className="mt-1.5 text-[10px] text-muted">Google no expone el crédito restante por API, así que ese número es un estimado nuestro. El saldo real (los ~USD 200/mes gratis) lo ves en la consola de Google.</p>
        </div>
        <p className="mt-2 text-[10px] text-muted">La key se saca en Google Cloud → APIs & Services → Credentials, con “Places API (New)” habilitada.</p>
      </div>

      <div className="flex justify-end">
        <button onClick={refreshBalance} disabled={balBusy} className="rounded-lg border border-white/[.08] px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-50">
          {balBusy ? "Actualizando…" : "↻ Actualizar saldos"}
        </button>
      </div>
    </div>
  );
}
