"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Tarjeta para instalar la app (PWA) desde el portal del socio, estilo Selly.
 *
 * - Android/Chrome: instala DIRECTO con el prompt nativo (beforeinstallprompt).
 * - iPhone/iOS: Apple NO permite instalar por código. Detectamos el iPhone y
 *   mostramos el paso a paso (Compartir → Agregar a inicio) con el ícono.
 * - Navegador embebido (Instagram/Facebook): ahí no se puede instalar; avisamos
 *   que abran en Safari/Chrome.
 */
export default function InstallAppButton({ appName }: { appName?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(!!standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(ua));
    setInApp(/FBAN|FBAV|Instagram|Line|Twitter|TikTok/i.test(ua));

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
    setShowHelp(true);
  }

  if (installed) return null;

  const nombre = appName ? `la app de ${appName}` : "la app";
  // iOS share glyph (cuadrado con flecha hacia arriba).
  const Share = () => (
    <svg viewBox="0 0 24 24" className="inline h-4 w-4 align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 7l4-4 4 4M6 12v7a2 2 0 002 2h8a2 2 0 002-2v-7" />
    </svg>
  );

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-surface p-5 text-center">
      <div className="text-base font-bold">📲 Instalá {nombre} en tu celular</div>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-2">
        No ocupa espacio (no es una app pesada) y queda como un ícono en tu pantalla de inicio,
        para entrar directo a tu rutina, dieta y clases.
      </p>
      <button onClick={install} className="btn btn-primary mt-4 w-full py-3 text-base font-semibold">
        Instalar app
      </button>

      {showHelp && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-xs text-ink-2">
          {inApp ? (
            <>
              <b>Estás dentro del navegador de otra app.</b> Para instalarla, abrí esta página en{" "}
              <b>{isIOS ? "Safari" : "Chrome"}</b>: tocá los <b>3 puntitos (⋯)</b> arriba y elegí{" "}
              <b>“Abrir en {isIOS ? "Safari" : "el navegador"}”</b>, y ahí tocá de nuevo “Instalar app”.
            </>
          ) : isIOS ? (
            <>
              En iPhone se agrega en 3 pasos:
              <ol className="mt-1.5 ml-4 list-decimal space-y-1">
                <li>Tocá el botón <b>Compartir</b> <Share /> (abajo en Safari).</li>
                <li>Deslizá y elegí <b>“Agregar a inicio”</b>.</li>
                <li>Tocá <b>“Agregar”</b> arriba a la derecha.</li>
              </ol>
            </>
          ) : (
            <>
              Abrí el menú del navegador (los <b>3 puntitos ⋮</b> arriba a la derecha) y tocá{" "}
              <b>“Instalar app”</b> o <b>“Agregar a pantalla de inicio”</b>.
            </>
          )}
        </div>
      )}
    </div>
  );
}
