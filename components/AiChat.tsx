"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

/**
 * Botón "Generar con IA" que abre una ventanita de chat flotante con el agente
 * (entrenador o nutricionista). El profe charla, el agente pregunta de a una
 * cosa hasta armar la rutina/dieta; aparece un preview con "Cargar en sistema"
 * que la guarda y asigna.
 */

interface MemberLite { id: string; full_name: string }
interface Msg { role: "user" | "assistant"; content: string }

const GREETING: Record<"rutina" | "dieta", string> = {
  rutina:
    "¡Hola! Soy Gimo 🤖, tu asistente. Te ayudo a armarle la rutina a tu socio en un ratito. Arranquemos: ¿qué objetivo buscás? (hipertrofia, fuerza, bajar grasa, tonificar, salud general)",
  dieta:
    "¡Hola! Soy Gimo 🤖, tu asistente. Te armo el plan de comidas para tu socio. Arranquemos: ¿qué objetivo buscás? (bajar grasa, ganar masa muscular, mantenimiento, rendimiento)",
};

export default function AiChat({
  kind,
  gymId,
  members,
  onDone,
  enabled = true,
}: {
  kind: "rutina" | "dieta";
  gymId: string | null;
  members: MemberLite[];
  onDone: () => void;
  /** Si el plan del gimnasio no incluye la IA, se muestra un botón bloqueado. */
  enabled?: boolean;
}) {
  const esRutina = kind === "rutina";
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING[kind] }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<any | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, pending]);

  const memberName = members.find((m) => m.id === memberId)?.full_name || null;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setErr(""); setSaved(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, gymId, memberName, messages: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data?.error || "No pude responder. Probá de nuevo.");
        setLoading(false);
        return;
      }
      if (data.type === "result") {
        setPending(data.data);
        setMessages((m) => [...m, { role: "assistant", content: data.text || "Listo, te armé esto 👇" }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.text }]);
      }
    } catch {
      setErr("Falló la conexión. Probá de nuevo.");
    }
    setLoading(false);
  }

  async function cargar() {
    if (!pending || !gymId || saving) return;
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/ai/guardar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, gymId, memberId: memberId || null, data: pending }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data?.error || "No se pudo cargar. Probá de nuevo.");
        setSaving(false);
        return;
      }
      const dest = memberName ? `asignada a ${memberName}` : "guardada como plantilla";
      setSaved(
        esRutina
          ? `✅ "${data.name}" ${dest} (${data.days} días, ${data.exercises} ejercicios).`
          : `✅ "${data.name}" ${dest} (${data.days} días, ${data.meals} comidas).`
      );
      setPending(null);
      onDone();
    } catch {
      setErr("Falló la conexión al guardar.");
    }
    setSaving(false);
  }

  function reset() {
    setMessages([{ role: "assistant", content: GREETING[kind] }]);
    setPending(null); setSaved(null); setErr(""); setInput("");
  }

  // Si el plan no incluye la IA, mostramos un botón bloqueado que invita a mejorar el plan.
  if (!enabled) {
    return (
      <Link
        href="/dashboard/mi-plan"
        className="btn btn-ghost opacity-80"
        title="La IA que genera rutinas y dietas está en el plan Elite"
      >
        🤖 Generar con IA
        <span className="ml-2 rounded-full bg-[rgba(245,177,61,.14)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#f5b13d]">
          Elite
        </span>
      </Link>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        🤖 Generar con IA
      </button>

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex max-h-[82vh] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-base">🤖</span>
              <span className="flex flex-col leading-tight">
                <span>Gimo</span>
                <span className="text-[10px] font-normal text-ink-2">{esRutina ? "Entrenador" : "Nutricionista"}</span>
              </span>
            </span>
            <button className="text-ink-2 hover:text-ink" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
          </div>

          {/* Socio destino */}
          <div className="border-b border-white/10 px-3 py-2">
            <select className="input w-full text-sm" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Plantilla general (sin socio)</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>

          {/* Conversación */}
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-black/20 p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-brand text-black" : "border border-white/10 bg-white/5 text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs text-ink-2">escribiendo…</div>}

            {/* Preview del resultado + Cargar en sistema */}
            {pending && (
              <div className="rounded-xl border border-brand/40 bg-[rgba(34,211,238,.06)] p-3">
                <div className="mb-1 text-sm font-bold">{pending.name || (esRutina ? "Rutina" : "Plan")}</div>
                {pending.resumen && <div className="mb-2 text-xs text-ink-2">{pending.resumen}</div>}
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {(pending.days || []).map((d: any, di: number) => (
                    <div key={di} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <div className="mb-1 text-xs font-semibold text-brand">{d.name || `Día ${di + 1}`}</div>
                      {esRutina
                        ? (d.blocks || []).map((b: any, bi: number) => (
                            <div key={bi} className="mb-1">
                              {b.name && <div className="text-[11px] uppercase tracking-wide text-muted">{b.name}</div>}
                              {(b.rows || []).map((r: any, ri: number) => (
                                <div key={ri} className="flex justify-between gap-2 text-xs">
                                  <span className="min-w-0">{r.exercise}</span>
                                  <span className="shrink-0 whitespace-nowrap text-ink-2">{r.sets || "-"} × {r.reps || "-"}</span>
                                </div>
                              ))}
                            </div>
                          ))
                        : (d.meals || []).map((ml: any, mi: number) => (
                            <div key={mi} className="text-xs">
                              <span className="text-muted">{ml.meal_type}: </span>
                              <span>{ml.title}</span>
                            </div>
                          ))}
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary mt-3 w-full" onClick={cargar} disabled={saving}>
                  {saving ? "Cargando…" : "⬇ Cargar en sistema"}
                </button>
              </div>
            )}
          </div>

          {/* Estado + input */}
          <div className="border-t border-white/10 p-2">
            {err && <p className="mb-2 px-1 text-xs text-crit">{err}</p>}
            {saved ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-brand/30 bg-[rgba(34,211,238,.08)] px-3 py-2 text-xs text-brand">
                <span className="min-w-0">{saved}</span>
                <button className="shrink-0 underline" onClick={reset}>Armar otra</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="Escribí tu respuesta…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  disabled={loading}
                  autoFocus
                />
                <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>
                  Enviar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
