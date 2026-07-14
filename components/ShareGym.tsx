"use client";

import { useState } from "react";

/**
 * Tarjeta para compartir la página del gimnasio con sus socios:
 * link de la página pública + acceso de socios, botones de copiar/compartir,
 * y un QR descargable para imprimir y pegar en el mostrador.
 */
export default function ShareGym({ slug, gymName }: { slug: string; gymName?: string }) {
  const [copied, setCopied] = useState<string>("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = slug ? `${origin}/${slug}` : "";
  const socioUrl = slug ? `${origin}/g/${slug}` : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=14&data=${encodeURIComponent(pageUrl)}`;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
    } catch { /* navegador sin clipboard */ }
  }

  async function share() {
    const data = { title: gymName || "Mi gimnasio", text: `Sumate a ${gymName || "nuestro gimnasio"} 💪`, url: pageUrl };
    // @ts-ignore
    if (navigator.share) { try { await navigator.share(data); } catch { /* cancelado */ } }
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${data.text} ${pageUrl}`)}`, "_blank");
  }

  async function downloadQr() {
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `qr-${slug || "gimnasio"}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(qrUrl, "_blank");
    }
  }

  if (!slug) {
    return (
      <div className="mb-4 rounded-2xl border border-white/10 bg-surface p-4 text-sm text-ink-2">
        Cargá y guardá el <b>slug</b> de tu página (más abajo) para generar tu link y tu QR para compartir.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-brand/25 bg-surface p-5">
      <div className="mb-1 text-sm font-bold">Compartí tu página con tus socios</div>
      <p className="mb-3 text-xs text-ink-2">
        Este es el link de tu gimnasio. Pasalo por WhatsApp o Instagram, o imprimí el QR y pegalo en el mostrador.
      </p>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          {/* Link de la página pública */}
          <label className="mb-1 block text-[11px] font-semibold text-ink-2">Tu página pública</label>
          <div className="flex gap-2">
            <input readOnly value={pageUrl} className="input flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button className="btn btn-ghost shrink-0" onClick={() => copy(pageUrl, "page")}>
              {copied === "page" ? "¡Copiado!" : "Copiar"}
            </button>
          </div>

          {/* Acceso de socios */}
          <label className="mb-1 mt-3 block text-[11px] font-semibold text-ink-2">Acceso directo de socios</label>
          <div className="flex gap-2">
            <input readOnly value={socioUrl} className="input flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button className="btn btn-ghost shrink-0" onClick={() => copy(socioUrl, "socio")}>
              {copied === "socio" ? "¡Copiado!" : "Copiar"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={share}>📤 Compartir</button>
            <a href={pageUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">Abrir mi página ↗</a>
          </div>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR de tu página" className="h-32 w-32 rounded-xl border-4 border-white bg-white p-1" />
          <button className="btn btn-ghost text-xs" onClick={downloadQr}>⬇ Descargar QR</button>
          <span className="text-[10px] text-muted">Para el mostrador</span>
        </div>
      </div>
    </div>
  );
}
