"use client";

import { useEffect, useRef, useState } from "react";
import { ARTICULOS, CATEGORIAS, buscarAyuda, type Articulo } from "@/lib/ayuda";

/**
 * Centro de ayuda: un cajón que se abre desde el signo de pregunta del panel.
 *
 * Tiene dos formas de encontrar algo, a propósito:
 *  1. El BUSCADOR sobre los artículos. No cuesta nada y es instantáneo.
 *  2. El AYUDANTE, que es IA. Cuesta plata (poca) y tarda unos segundos.
 *
 * El buscador va primero y el ayudante aparece recién cuando la búsqueda no
 * encontró nada, o si lo abre a propósito: la mayoría de las preguntas las
 * contesta un artículo, y no tiene sentido pagar por eso.
 */

type Msg = { role: "user" | "assistant"; content: string };

export default function AyudaPanel({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [q, setQ] = useState("");
  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [modoChat, setModoChat] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const finChat = useRef<HTMLDivElement | null>(null);
  const buscador = useRef<HTMLInputElement | null>(null);

  const resultados = q.trim() ? buscarAyuda(q) : [];

  // Al abrir, el cursor va al buscador. Cerrar con Escape.
  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(() => buscador.current?.focus(), 80);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", esc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", esc); };
  }, [abierto, onCerrar]);

  useEffect(() => { finChat.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, pensando]);

  function volver() { setArticulo(null); setModoChat(false); }

  function abrirChat(texto?: string) {
    setArticulo(null);
    setModoChat(true);
    if (texto) setPregunta(texto);
  }

  async function preguntar(e?: React.FormEvent) {
    e?.preventDefault();
    const texto = pregunta.trim();
    if (!texto || pensando) return;
    const nuevos: Msg[] = [...msgs, { role: "user", content: texto }];
    setMsgs(nuevos);
    setPregunta("");
    setPensando(true);
    try {
      const r = await fetch("/api/ayuda", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nuevos }),
      });
      const j = (await r.json()) as { ok?: boolean; text?: string; error?: string };
      setMsgs((m) => [...m, {
        role: "assistant",
        content: j.ok && j.text ? j.text : (j.error || "No pude contestarte ahora."),
      }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Se cortó la conexión. Probá de nuevo." }]);
    }
    setPensando(false);
  }

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onCerrar}>
      <aside
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="Centro de ayuda"
        className="flex h-full w-full max-w-[440px] flex-col border-l border-white/10 bg-surface shadow-2xl"
      >
        {/* Encabezado */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3.5">
          {(articulo || modoChat) && (
            <button onClick={volver} aria-label="Volver"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-ink-2 transition hover:border-white/25 hover:text-ink">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 6 9 12 15 18" /></svg>
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {articulo ? articulo.titulo : modoChat ? "Preguntale al ayudante" : "¿En qué te damos una mano?"}
          </h2>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:text-ink">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ── Un artículo ────────────────────────────────────────────── */}
        {articulo ? (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{articulo.categoria}</div>
            <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-ink-2">
              {articulo.cuerpo.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <button onClick={() => abrirChat()}
              className="mt-6 w-full rounded-lg border border-white/10 px-3 py-2.5 text-xs text-ink-2 transition hover:border-brand/40 hover:text-ink">
              ¿Te quedó una duda? Preguntale al ayudante
            </button>
          </div>

        /* ── El ayudante (IA) ───────────────────────────────────────── */
        ) : modoChat ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-surface-2 p-3.5 text-[13px] leading-relaxed text-ink-2">
                  Preguntame cualquier cosa de cómo se usa TurnoGym y te digo dónde está.
                  Contesto con lo que hay en la ayuda: si algo no lo sé, te lo digo en vez de inventarlo.
                </div>
              )}
              <div className="flex flex-col gap-3">
                {msgs.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                        m.role === "user" ? "text-[color:var(--on-brand)]" : "border border-white/10 bg-surface-2 text-ink-2"
                      }`}
                      style={m.role === "user"
                        ? { background: "linear-gradient(135deg, rgb(var(--brand-rgb)), rgb(var(--brand-2-rgb)))" }
                        : undefined}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {pensando && (
                  <div className="flex justify-start">
                    <div className="rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-[13px] text-muted">
                      Buscando en la ayuda…
                    </div>
                  </div>
                )}
              </div>
              <div ref={finChat} />
            </div>
            <form onSubmit={preguntar} className="flex gap-2 border-t border-white/10 p-3">
              <input
                className="input min-w-0 flex-1" placeholder="Ej: ¿cada cuánto pueden reservar?"
                value={pregunta} onChange={(e) => setPregunta(e.target.value)} autoFocus
              />
              <button type="submit" className="btn btn-primary shrink-0 px-3 text-xs" disabled={pensando || !pregunta.trim()}>
                Enviar
              </button>
            </form>
          </>

        /* ── Buscador + índice ──────────────────────────────────────── */
        ) : (
          <>
            <div className="border-b border-white/10 px-4 py-3">
              <input
                ref={buscador} className="input" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscá: cancelar, recargo, colores…"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {q.trim() ? (
                resultados.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {resultados.map((a) => <Fila key={a.id} a={a} onClick={() => setArticulo(a)} conCategoria />)}
                  </ul>
                ) : (
                  <div className="px-1 py-6 text-center">
                    <p className="text-sm text-ink-2">No encontré nada con “{q.trim()}”.</p>
                    <button onClick={() => abrirChat(q.trim())} className="btn btn-primary mt-3 text-xs">
                      Preguntarle al ayudante
                    </button>
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-4">
                  {CATEGORIAS.map((cat) => {
                    const dela = ARTICULOS.filter((a) => a.categoria === cat);
                    if (dela.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{cat}</div>
                        <ul className="flex flex-col gap-0.5">
                          {dela.map((a) => <Fila key={a.id} a={a} onClick={() => setArticulo(a)} />)}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-white/10 p-3">
              <button onClick={() => abrirChat()}
                className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-xs text-ink-2 transition hover:border-brand/40 hover:text-ink">
                ¿No encontrás lo que buscás? Preguntale al ayudante
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Fila({ a, onClick, conCategoria }: { a: Articulo; onClick: () => void; conCategoria?: boolean }) {
  return (
    <li>
      <button onClick={onClick}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-white/[.04]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px]">{a.titulo}</span>
          {conCategoria && <span className="block truncate text-[11px] text-muted">{a.categoria}</span>}
        </span>
        <span className="shrink-0 text-muted">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
        </span>
      </button>
    </li>
  );
}
