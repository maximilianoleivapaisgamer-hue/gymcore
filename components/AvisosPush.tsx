"use client";

import { useEffect, useState } from "react";

/**
 * "Avisame al celular": el alta de las notificaciones, desde la app del socio.
 *
 * Registra el service worker, pide permiso y guarda la suscripción de ESTE
 * navegador. La misma persona puede activarlo en el celular y en la compu: son
 * dos suscripciones distintas y las dos reciben.
 *
 * ⚠️ En iPhone las notificaciones web SOLO funcionan si la app está agregada a
 * la pantalla de inicio. Desde Safari normal no hay forma, y el navegador ni
 * siquiera expone la API. Por eso, cuando detectamos iPhone sin instalar, se
 * explica en vez de ofrecer un botón que no va a andar.
 */

type Estado = "cargando" | "no-soportado" | "ios-sin-instalar" | "bloqueado" | "apagado" | "prendido";

/** La clave VAPID viene en base64url y el navegador la pide como bytes. */
function claveABytes(base64: string): ArrayBuffer {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const crudo = atob(normal);
  const bytes = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes.buffer;
}

const esIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const estaInstalada = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

export default function AvisosPush() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const soporta =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!clave) { setEstado("no-soportado"); return; }

      // El iPhone sin instalar ni siquiera tiene PushManager: hay que explicarlo.
      if (!soporta) {
        setEstado(esIOS() && !estaInstalada() ? "ios-sin-instalar" : "no-soportado");
        return;
      }

      try {
        // El service worker se registra igual, aunque no active los avisos:
        // es lo que hace que la app funcione sin señal y que Android ofrezca
        // instalarla de verdad.
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (Notification.permission === "denied") { setEstado("bloqueado"); return; }
        const sub = await reg.pushManager.getSubscription();
        setEstado(sub ? "prendido" : "apagado");
      } catch {
        setEstado("no-soportado");
      }
    })();
  }, []);

  async function prender() {
    setTrabajando(true); setError("");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "apagado");
        setTrabajando(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveABytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
      });
      const r = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      const j = await r.json();
      if (!j.ok) {
        await sub.unsubscribe().catch(() => {});
        setError(j.error || "No pudimos activar los avisos.");
      } else {
        setEstado("prendido");
      }
    } catch {
      setError("No pudimos activar los avisos. Probá de nuevo.");
    }
    setTrabajando(false);
  }

  async function apagar() {
    setTrabajando(true); setError("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub?.endpoint }),
      });
      await sub?.unsubscribe().catch(() => {});
      setEstado("apagado");
    } catch {
      setError("No pudimos desactivarlos. Probá de nuevo.");
    }
    setTrabajando(false);
  }

  if (estado === "cargando" || estado === "no-soportado") return null;

  return (
    <div className="rounded-xl border border-white/10 bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Avisame al celular</div>
          <p className="mt-0.5 text-xs leading-snug text-ink-2">
            {estado === "prendido"
              ? "Te avisamos antes de tus clases y cuando se te vence la cuota."
              : "Antes de tus clases y cuando se te vence la cuota, sin depender de que abras la app."}
          </p>
        </div>

        {estado === "apagado" && (
          <button className="btn btn-primary shrink-0 text-xs" onClick={prender} disabled={trabajando}>
            {trabajando ? "Activando…" : "Activar"}
          </button>
        )}
        {estado === "prendido" && (
          <button className="btn btn-ghost shrink-0 text-xs" onClick={apagar} disabled={trabajando}>
            {trabajando ? "…" : "Desactivar"}
          </button>
        )}
      </div>

      {estado === "ios-sin-instalar" && (
        <p className="mt-2 text-xs leading-snug text-[#f5b13d]">
          En iPhone los avisos andan solo con la app instalada. Tocá el botón de compartir
          y elegí <b>Agregar a inicio</b>; después volvé acá y activalos.
        </p>
      )}
      {estado === "bloqueado" && (
        <p className="mt-2 text-xs leading-snug text-[#f5b13d]">
          Bloqueaste los avisos para este sitio. Habilitalos desde la configuración de tu
          navegador y volvé a intentar.
        </p>
      )}
      {estado === "prendido" && (
        <p className="mt-2 text-[11px] text-muted">
          Activados en este dispositivo. Si usás otro teléfono, activalos también ahí.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-crit">{error}</p>}
    </div>
  );
}
