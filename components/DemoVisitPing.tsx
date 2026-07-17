"use client";

import { useEffect } from "react";

/**
 * Registra actividad de una DEMO (para saber si el prospecto la usó):
 *   kind = "web"   → abrió la web pública
 *   kind = "panel" → entró al panel del dueño
 *   kind = "socio" → entró a la app del socio
 *
 * IMPORTANTE: NO cuenta si el navegador está marcado como "dueño" (tg_owner),
 * que se setea cuando vos (super admin) usás el panel de admin. Así tus propias
 * aperturas/logins NO inflan los números: solo cuentan los prospectos.
 * Además dedupe por sesión de pestaña.
 */
export default function DemoVisitPing({ gymId, kind = "web" }: { gymId: string; kind?: "web" | "panel" | "socio" }) {
  useEffect(() => {
    if (!gymId) return;
    try {
      if (localStorage.getItem("tg_owner") === "1") return; // es tu equipo → no contamos
      const k = `tg_demo_ping_${kind}_${gymId}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch { /* si no hay storage, igual pingueamos */ }
    fetch("/api/demo/visita", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gymId, kind }),
      keepalive: true,
    }).catch(() => {});
  }, [gymId, kind]);
  return null;
}
