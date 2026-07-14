"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Tarjeta para instalar la app (PWA) desde el portal del socio, estilo Selly:
 * siempre visible (salvo que ya esté instalada), con un botón grande "Instalar
 * app" que dispara la instalación en el momento. Si el navegador no soporta el
 * prompt directo (iOS Safari, o Chrome que todavía no lo habilitó), muestra el
 * paso a paso.
 */
export default function InstallAppButton({ appName }: { appName?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(!!standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent || ""));

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    // Sin prompt disponible: mostramos el paso a paso.
    setShowHelp(true);
  }

  if (installed) return null;

  const nombre = appName ? `la app de ${appName}` : "la app";

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-surface p-5 text-center">
      <div className="text-base font-bold">📲 Instalá {nombre} en tu celular</div>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-2">
        No ocupa espacio (no es una app pesada) y queda como un ícono en tu pantalla de inicio,
        para entrar directo a tu rutina, dieta y clases.
      </p>
      <button
        onClick={install}
        className="btn btn-primary mt-4 w-full py-3 text-base font-semibold"
      >
        Instalar app
      </button>

      {showHelp && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-xs text-ink-2">
          {isIOS ? (
            <>Para instalarla en iPhone: tocá el botón <b>Compartir</b> (⬆️) abajo en Safari y elegí <b>“Agregar a pantalla de inicio”</b>.</>
          ) : (
            <>Abrí el menú del navegador (los <b>3 puntitos ⋮</b> arriba a la derecha) y tocá <b>“Instalar app”</b> o <b>“Agregar a pantalla de inicio”</b>.</>
          )}
        </div>
      )}
    </div>
  );
}
