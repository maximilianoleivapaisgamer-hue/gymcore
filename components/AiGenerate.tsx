"use client";

import { useState } from "react";

/**
 * Botón "Generar con IA" + modal de parámetros, reutilizable para Rutinas y
 * Dietas. Flujo automático: al confirmar, llama a la API, que genera y guarda
 * el plan asignado al socio. Al terminar, dispara onDone() para refrescar la
 * lista del panel.
 */

interface MemberLite { id: string; full_name: string }

export default function AiGenerate({
  kind,
  gymId,
  members,
  onDone,
}: {
  kind: "rutina" | "dieta";
  gymId: string | null;
  members: MemberLite[];
  onDone: () => void;
}) {
  const esRutina = kind === "rutina";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<string>("");

  // Campos comunes
  const [memberId, setMemberId] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [dias, setDias] = useState(esRutina ? 3 : 7);
  const [comentarios, setComentarios] = useState("");

  // Rutina
  const [nivel, setNivel] = useState("principiante");
  const [equipamiento, setEquipamiento] = useState("gimnasio completo");

  // Dieta
  const [calorias, setCalorias] = useState<string>("");
  const [comidas, setComidas] = useState(4);
  const [restricciones, setRestricciones] = useState("");

  function reset() {
    setErr(""); setOk(""); setLoading(false);
  }

  async function generar() {
    if (!gymId) { setErr("No se pudo identificar el gimnasio."); return; }
    if (!memberId) { setErr("Elegí un socio."); return; }
    setLoading(true); setErr(""); setOk("");

    const payload = esRutina
      ? { gymId, memberId, objetivo, nivel, dias, equipamiento, comentarios }
      : { gymId, memberId, objetivo, calorias: Number(calorias) || 0, comidas, dias, restricciones, comentarios };

    try {
      const res = await fetch(`/api/ai/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data?.error || "No se pudo generar. Probá de nuevo.");
        setLoading(false);
        return;
      }
      const socio = members.find((m) => m.id === memberId)?.full_name || "el socio";
      setOk(
        esRutina
          ? `✅ "${data.name}" generada y asignada a ${socio} (${data.days} días, ${data.exercises} ejercicios).`
          : `✅ "${data.name}" generado y asignado a ${socio} (${data.days} días, ${data.meals} comidas).`
      );
      setLoading(false);
      onDone();
    } catch {
      setErr("Falló la conexión. Probá de nuevo.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => { reset(); setOpen(true); }}
        title={esRutina ? "Generar una rutina con IA" : "Generar un plan de comidas con IA"}
      >
        ✨ Generar con IA
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => !loading && setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {esRutina ? "✨ Entrenador IA" : "✨ Nutricionista IA"}
              </h3>
              <button className="text-ink-2 hover:text-ink" onClick={() => !loading && setOpen(false)}>✕</button>
            </div>
            <p className="mb-4 text-sm text-ink-2">
              {esRutina
                ? "Elegí el socio y el objetivo. La IA arma la rutina completa y se la asigna."
                : "Elegí el socio y el objetivo. La IA arma el plan de comidas y se lo asigna."}
            </p>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-2">Socio</span>
                <select className="input w-full" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="">Elegí un socio…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-2">Objetivo</span>
                <input
                  className="input w-full"
                  placeholder={esRutina ? "Ej: hipertrofia, bajar grasa, fuerza…" : "Ej: bajar grasa, ganar masa, mantenimiento…"}
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                />
              </label>

              {esRutina ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink-2">Nivel</span>
                    <select className="input w-full" value={nivel} onChange={(e) => setNivel(e.target.value)}>
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink-2">Días / semana</span>
                    <input type="number" min={1} max={7} className="input w-full" value={dias} onChange={(e) => setDias(Number(e.target.value) || 3)} />
                  </label>
                  <label className="col-span-2 block">
                    <span className="mb-1 block text-xs font-semibold text-ink-2">Equipamiento</span>
                    <input className="input w-full" placeholder="Ej: gimnasio completo / en casa con mancuernas" value={equipamiento} onChange={(e) => setEquipamiento(e.target.value)} />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink-2">Comidas / día</span>
                    <input type="number" min={2} max={6} className="input w-full" value={comidas} onChange={(e) => setComidas(Number(e.target.value) || 4)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink-2">Días distintos</span>
                    <input type="number" min={1} max={7} className="input w-full" value={dias} onChange={(e) => setDias(Number(e.target.value) || 7)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink-2">Calorías/día (opcional)</span>
                    <input type="number" min={0} className="input w-full" placeholder="Ej: 2000" value={calorias} onChange={(e) => setCalorias(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink-2">Restricciones</span>
                    <input className="input w-full" placeholder="Ej: vegetariano, sin TACC" value={restricciones} onChange={(e) => setRestricciones(e.target.value)} />
                  </label>
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-2">
                  {esRutina ? "Notas / lesiones (opcional)" : "Notas / preferencias (opcional)"}
                </span>
                <textarea
                  className="input min-h-[64px] w-full"
                  placeholder={esRutina ? "Ej: cuida la rodilla derecha, no hacer sentadilla profunda" : "Ej: no le gusta el pescado, poco tiempo para cocinar"}
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                />
              </label>
            </div>

            {err && <p className="mt-3 rounded-lg border border-[#f05252]/30 bg-[rgba(240,82,82,.1)] px-3 py-2 text-sm text-[#f05252]">{err}</p>}
            {ok && <p className="mt-3 rounded-lg border border-brand/30 bg-[rgba(34,211,238,.08)] px-3 py-2 text-sm text-brand">{ok}</p>}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={loading}>
                {ok ? "Cerrar" : "Cancelar"}
              </button>
              {!ok && (
                <button className="btn btn-primary" onClick={generar} disabled={loading}>
                  {loading ? "Generando… (puede tardar unos segundos)" : "✨ Generar y asignar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
