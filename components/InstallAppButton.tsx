"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Botón/banner para instalar GymCore como app (PWA) desde el portal del
 * socio. En Chrome/Android usa el evento beforeinstallprompt; en iOS Safari
 * (que no lo soporta) muestra instrucciones manuales de "Agregar a inicio".
 */
export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(true); // arranca oculto hasta confirmar que corresponde mostrarlo

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(!!standalone);

    const ua = window.navigator.userAgent || "";
    setIsIOS(/iphone|ipad|ipod/i.test(ua));

    let wasDismissed = false;
    try { wasDismissed = localStorage.getItem("gymcore_install_dismissed") === "1"; } catch { /* noop */ }
    setDismissed(wasDismissed);

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem("gymcore_install_dismissed", "1"); } catch { /* noop */ }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (installed || dismissed) return null;
  if (!deferred && !isIOS) return null; // Chrome desktop/Android que todavía no disparó el evento

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-[rgba(34,211,238,.08)] px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">📲 Descargá la app</div>
        <div className="text-xs text-ink-2">
          {isIOS && !deferred
            ? "Tocá compartir (⬆️) y elegí “Agregar a pantalla de inicio”."
            : "No ocupa memoria y queda como una app más en tu celular."}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {deferred && (
          <button className="btn btn-primary text-xs" onClick={install}>Instalar</button>
        )}
        <button className="text-ink-2 hover:text-ink" onClick={dismiss} title="Cerrar">×</button>
      </div>
    </div>
  );
}
