"use client";

import { useEffect, useState } from "react";

/**
 * Cartel flotante que aparece cuando el super admin entró a la cuenta de un
 * cliente desde /api/admin/entrar. Sirve para no confundirse y creer que estás
 * en tu propia cuenta, y para volver a la tuya de un click.
 *
 * Lee la cookie `tg_viendo_como` (formato "rol|gimnasio|quien"). No lleva nada
 * sensible: el id del super admin va en otra cookie httpOnly que el navegador
 * no puede leer.
 */
export default function ViendoComo() {
  const [info, setInfo] = useState<{ rol: string; gym: string; quien: string } | null>(null);

  useEffect(() => {
    const raw = document.cookie.split("; ").find((c) => c.startsWith("tg_viendo_como="));
    if (!raw) return;
    const [rol, gym, quien] = decodeURIComponent(raw.split("=").slice(1).join("=")).split("|");
    if (rol) setInfo({ rol, gym: gym || "", quien: quien || "" });
  }, []);

  if (!info) return null;

  const que = info.rol === "socio" ? "la app del socio" : "el panel";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border border-[#f5b13d]/40 bg-[#1a1408] px-3.5 py-2 text-xs shadow-lg shadow-black/40">
        <span aria-hidden>👁️</span>
        <span className="min-w-0 truncate text-[#f5b13d]">
          Estás viendo {que} de <b className="text-ink">{info.gym}</b>
          {info.quien ? <span className="text-muted"> · como {info.quien}</span> : null}
        </span>
        <a
          href="/api/admin/volver"
          className="shrink-0 rounded-full bg-[#f5b13d] px-3 py-1 font-semibold text-black hover:brightness-110"
        >
          Volver al Super Admin
        </a>
      </div>
    </div>
  );
}
