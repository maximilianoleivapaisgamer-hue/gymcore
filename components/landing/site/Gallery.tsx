"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import type { LPhoto } from "@/lib/landing-config";

/**
 * Galería en grilla con lightbox. Tocar una foto la abre en grande; flechas o
 * Esc para navegar/cerrar. Cada foto cargada aparece como una tarjeta.
 */
export function Gallery({ images }: { images: LPhoto[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  const open = idx !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdx(null);
      else if (e.key === "ArrowRight") setIdx((i) => (i === null ? i : (i + 1) % images.length));
      else if (e.key === "ArrowLeft") setIdx((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, images.length]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`group relative overflow-hidden rounded-[16px] border ${i === 0 && images.length > 2 ? "col-span-2 row-span-2 sm:col-span-2" : ""}`}
            style={{ borderColor: "var(--l-border)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.alt} className="h-full min-h-[150px] w-full object-cover transition duration-300 group-hover:scale-105" />
          </button>
        ))}
      </div>

      {open && idx !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setIdx(null)}>
          <button className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white" aria-label="Cerrar" onClick={() => setIdx(null)}>
            <Icon name="X" className="size-6" />
          </button>
          {images.length > 1 && (
            <>
              <button
                className="absolute left-3 grid size-11 place-items-center rounded-full bg-white/10 text-white sm:left-6"
                aria-label="Anterior"
                onClick={(e) => { e.stopPropagation(); setIdx((i) => (i === null ? i : (i - 1 + images.length) % images.length)); }}
              >‹</button>
              <button
                className="absolute right-3 grid size-11 place-items-center rounded-full bg-white/10 text-white sm:right-6"
                aria-label="Siguiente"
                onClick={(e) => { e.stopPropagation(); setIdx((i) => (i === null ? i : (i + 1) % images.length)); }}
              >›</button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[idx].src}
            alt={images[idx].alt}
            className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
