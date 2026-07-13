"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import type { Gym, LandingSectionConfig, LandingSectionKey, MemberPlan } from "@/types/db";
import { DEFAULT_LANDING_SECTIONS, LANDING_SECTION_LABELS } from "@/types/db";
import { combinedLandingPlans, visibleLandingSections } from "@/lib/landing";
import { THEMES, BG_STYLES } from "@/lib/theme";
import ThemeApply from "@/components/ThemeApply";

/**
 * Editor de la página pública del gimnasio.
 * El dueño sube su logo, foto de portada y fotos estilo banner (galería),
 * elige color, edita textos, configura sus planes en una lista, elige entre
 * las plantillas de landing disponibles y define el orden/visibilidad de las
 * secciones opcionales. Ve el preview en vivo (ya filtrado y ordenado igual
 * que la página real) y guarda en Supabase. Las imágenes van al bucket
 * "gym-assets". La landing pública (/[slug]) lee estos mismos datos.
 */
export default function ConfiguracionPage() {
  const supabase = createClient();
  const [gym, setGym] = useState<Partial<Gym>>({
    name: "",
    slug: "",
    accent_color: "#22d3ee",
    tagline: "",
    description: "",
    benefits: [],
    member_plans: [],
    whatsapp: "",
    address: "",
    instagram: "",
    gallery: [],
    testimonials: [],
    class_schedule: [],
    open_hours: "",
    logo_url: null,
    hero_url: null,
    landing_template: "clasica",
    landing_sections: DEFAULT_LANDING_SECTIONS,
    theme: "celeste",
    bg_style: "aurora",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Cargar el gimnasio del dueño logueado
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("gyms")
        .select("*")
        .eq("owner_id", user.id)
        .single<Gym>();
      if (data) {
        setGym({
          ...data,
          landing_template: data.landing_template || "clasica",
          landing_sections: data.landing_sections?.length ? data.landing_sections : DEFAULT_LANDING_SECTIONS,
          theme: data.theme || "celeste",
          bg_style: data.bg_style || "aurora",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof Gym>(key: K, value: Gym[K]) {
    setGym((g) => ({ ...g, [key]: value }));
  }

  async function uploadImage(file: File, field: "logo_url" | "hero_url") {
    const path = `${field}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage
      .from("gym-assets")
      .upload(path, file, { upsert: true });
    if (error) return setMsg("Error al subir la imagen");
    const { data } = supabase.storage.from("gym-assets").getPublicUrl(path);
    set(field, data.publicUrl);
  }

  async function uploadGallery(files: FileList) {
    setMsg("Subiendo fotos…");
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `gallery/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage
        .from("gym-assets")
        .upload(path, file, { upsert: true });
      if (error) {
        setMsg("Error al subir una foto");
        continue;
      }
      const { data } = supabase.storage.from("gym-assets").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setGym((g) => ({ ...g, gallery: [...(g.gallery || []), ...urls] }));
    setMsg("");
  }

  function removeGalleryImg(i: number) {
    setGym((g) => ({ ...g, gallery: (g.gallery || []).filter((_, idx) => idx !== i) }));
  }

  // ---- Planes (lista editable) ----
  function addPlan() {
    setGym((g) => ({
      ...g,
      member_plans: [...(g.member_plans || []), { name: "", price: 0, detail: "" }],
    }));
  }
  function setPlan(i: number, patch: Partial<MemberPlan>) {
    setGym((g) => ({
      ...g,
      member_plans: (g.member_plans || []).map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    }));
  }
  function removePlan(i: number) {
    setGym((g) => ({
      ...g,
      member_plans: (g.member_plans || []).filter((_, idx) => idx !== i),
    }));
  }

  // ---- Testimonios (lista editable) ----
  function addTestimonial() {
    setGym((g) => ({ ...g, testimonials: [...(g.testimonials || []), { name: "", text: "" }] }));
  }
  function setTestimonial(i: number, patch: Partial<{ name: string; text: string }>) {
    setGym((g) => ({
      ...g,
      testimonials: (g.testimonials || []).map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    }));
  }
  function removeTestimonial(i: number) {
    setGym((g) => ({ ...g, testimonials: (g.testimonials || []).filter((_, idx) => idx !== i) }));
  }

  // ---- Horarios / clases (lista editable) ----
  function addSchedule() {
    setGym((g) => ({ ...g, class_schedule: [...(g.class_schedule || []), { day: "", time: "", name: "" }] }));
  }
  function setSchedule(i: number, patch: Partial<{ day: string; time: string; name: string }>) {
    setGym((g) => ({
      ...g,
      class_schedule: (g.class_schedule || []).map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  }
  function removeSchedule(i: number) {
    setGym((g) => ({ ...g, class_schedule: (g.class_schedule || []).filter((_, idx) => idx !== i) }));
  }

  // ---- Orden/visibilidad de secciones ----
  const sectionList: LandingSectionConfig[] = gym.landing_sections?.length ? gym.landing_sections : DEFAULT_LANDING_SECTIONS;

  function moveSection(i: number, dir: -1 | 1) {
    setGym((g) => {
      const list = [...(g.landing_sections?.length ? g.landing_sections : DEFAULT_LANDING_SECTIONS)];
      const j = i + dir;
      if (j < 0 || j >= list.length) return g;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...g, landing_sections: list };
    });
  }

  function toggleSectionVisible(i: number) {
    setGym((g) => {
      const list = [...(g.landing_sections?.length ? g.landing_sections : DEFAULT_LANDING_SECTIONS)];
      list[i] = { ...list[i], visible: !list[i].visible };
      return { ...g, landing_sections: list };
    });
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("gyms")
      .update({
        name: gym.name,
        slug: gym.slug,
        accent_color: gym.accent_color,
        tagline: gym.tagline,
        description: gym.description,
        benefits: gym.benefits,
        member_plans: gym.member_plans,
        whatsapp: gym.whatsapp,
        address: gym.address,
        instagram: gym.instagram,
        gallery: gym.gallery,
        testimonials: gym.testimonials,
        class_schedule: gym.class_schedule,
        open_hours: gym.open_hours,
        logo_url: gym.logo_url,
        hero_url: gym.hero_url,
        landing_template: gym.landing_template || "clasica",
        landing_sections: sectionList,
        theme: gym.theme || "celeste",
        bg_style: gym.bg_style || "aurora",
      })
      .eq("owner_id", user.id);
    setSaving(false);
    setMsg(error ? "No se pudo guardar" : "¡Guardado! Tu página ya está publicada.");
  }

  const accent = gym.accent_color || "#22d3ee";
  const plans = combinedLandingPlans(gym);
  const previewSections = visibleLandingSections(gym, plans);

  return (
    <div className="grid min-h-screen lg:grid-cols-[380px_1fr]">
      {/* Aplica el color elegido en vivo mientras se edita */}
      <ThemeApply theme={gym.theme} />
      {/* EDITOR */}
      <div className="border-r border-white/10 bg-[#0b0f16] p-5">
        <h1 className="mb-4 text-lg font-bold">Configurá tu página</h1>

        {/* TEMA DE LA APP (color + fondo) */}
        <label className="mb-2 block text-xs font-semibold text-ink-2">Color de la app</label>
        <div className="mb-3 flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.label}
              onClick={() => { set("theme", t.key); set("accent_color", t.hex); }}
              className={`h-9 w-9 rounded-full border-2 transition ${gym.theme === t.key ? "scale-110 border-white" : "border-white/20 hover:border-white/50"}`}
              style={{ background: t.hex }}
            />
          ))}
        </div>
        <label className="mb-2 block text-xs font-semibold text-ink-2">Fondo de la app</label>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {BG_STYLES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => set("bg_style", b.key)}
              className={`rounded-lg border p-2 text-left transition ${gym.bg_style === b.key ? "border-brand bg-white/5" : "border-white/10 hover:bg-white/5"}`}
            >
              <div className="text-xs font-semibold">{b.label}</div>
              <div className="text-[10px] leading-snug text-muted">{b.desc}</div>
            </button>
          ))}
        </div>
        <p className="mb-4 text-[11px] text-muted">
          El color tiñe los botones, los acentos y el fondo de todo el panel, el portal del socio y el login — así siempre combina.
        </p>

        <label className="mb-1 block text-xs font-semibold text-ink-2">Logo</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "logo_url")}
          className="mb-3 text-sm"
        />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Foto de portada</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "hero_url")}
          className="mb-3 text-sm"
        />

        <label className="mb-1 block text-xs font-semibold text-ink-2">
          Fotos estilo banner (galería)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => e.target.files?.length && uploadGallery(e.target.files)}
          className="mb-2 text-sm"
        />
        {(gym.gallery || []).length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(gym.gallery || []).map((url, i) => (
              <div key={i} className="group relative overflow-hidden rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-16 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeGalleryImg(i)}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-xs text-white opacity-0 transition group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="mb-1 block text-xs font-semibold text-ink-2">Color de marca</label>
        <input
          type="color"
          value={accent}
          onChange={(e) => set("accent_color", e.target.value)}
          className="mb-3 h-9 w-16 rounded"
        />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Nombre</label>
        <input className="input mb-3" value={gym.name || ""} onChange={(e) => set("name", e.target.value)} />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Slug (URL)</label>
        <input className="input mb-3" value={gym.slug || ""} onChange={(e) => set("slug", e.target.value)} />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Título</label>
        <input className="input mb-3" value={gym.tagline || ""} onChange={(e) => set("tagline", e.target.value)} />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Descripción</label>
        <textarea
          className="input mb-3"
          rows={3}
          value={gym.description || ""}
          onChange={(e) => set("description", e.target.value)}
        />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Beneficios (uno por línea)</label>
        <textarea
          className="input mb-3"
          rows={3}
          value={(gym.benefits || []).join("\n")}
          onChange={(e) => set("benefits", e.target.value.split("\n").filter(Boolean))}
        />

        {/* TESTIMONIOS — lista editable */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-semibold text-ink-2">Testimonios de socios</label>
            <button
              type="button"
              onClick={addTestimonial}
              className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-ink hover:bg-white/5"
            >
              + Agregar
            </button>
          </div>
          <div className="space-y-2">
            {(gym.testimonials || []).map((t, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="mb-1 flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Nombre del socio"
                    value={t.name}
                    onChange={(e) => setTestimonial(i, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeTestimonial(i)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 text-sm text-ink-2 hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Su comentario / opinión"
                  value={t.text}
                  onChange={(e) => setTestimonial(i, { text: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* HORARIOS / CLASES — lista editable */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-semibold text-ink-2">Horarios y clases</label>
            <button
              type="button"
              onClick={addSchedule}
              className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-ink hover:bg-white/5"
            >
              + Agregar
            </button>
          </div>
          <div className="space-y-2">
            {(gym.class_schedule || []).map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
                <input
                  className="input w-24"
                  placeholder="Día"
                  value={s.day}
                  onChange={(e) => setSchedule(i, { day: e.target.value })}
                />
                <input
                  className="input w-24"
                  placeholder="Horario"
                  value={s.time}
                  onChange={(e) => setSchedule(i, { time: e.target.value })}
                />
                <input
                  className="input flex-1"
                  placeholder="Clase"
                  value={s.name}
                  onChange={(e) => setSchedule(i, { name: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeSchedule(i)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 text-sm text-ink-2 hover:bg-white/5"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ORDEN Y VISIBILIDAD DE SECCIONES */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-semibold text-ink-2">Orden de las secciones</label>
          <p className="mb-2 text-[11px] text-muted">
            El encabezado, la portada y el llamado a la acción final siempre se muestran. Acá elegís en qué orden
            aparece el resto, y podés ocultar las que no quieras usar.
          </p>
          <div className="space-y-1.5">
            {sectionList.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="flex flex-col leading-none">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveSection(i, -1)}
                    className="px-1 text-xs text-ink-2 hover:text-ink disabled:opacity-20"
                    aria-label="Subir"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === sectionList.length - 1}
                    onClick={() => moveSection(i, 1)}
                    className="px-1 text-xs text-ink-2 hover:text-ink disabled:opacity-20"
                    aria-label="Bajar"
                  >
                    ▼
                  </button>
                </div>
                <span className={`flex-1 text-sm ${s.visible ? "" : "text-muted line-through"}`}>
                  {LANDING_SECTION_LABELS[s.key]}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-ink-2">
                  <input type="checkbox" checked={s.visible} onChange={() => toggleSectionVisible(i)} />
                  Visible
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* PLANES — lista editable */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-semibold text-ink-2">Planes de esta página</label>
            <button
              type="button"
              onClick={addPlan}
              className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-ink hover:bg-white/5"
            >
              + Agregar plan
            </button>
          </div>
          <p className="mb-2 text-xs text-muted">
            Estos planes son solo para mostrar en tu página pública (podés poner precios promocionales). Para los
            planes reales que le cobrás a tus socios, configuralos en{" "}
            <Link href="/dashboard/planes" className="text-brand">Planes</Link> — desde ahí también podés tildar cuáles
            sincronizar automáticamente acá.
          </p>
          {(gym.member_plans || []).length === 0 && (
            <p className="mb-2 text-xs text-muted">Todavía no cargaste planes. Agregá al menos uno.</p>
          )}
          <div className="space-y-3">
            {(gym.member_plans || []).map((p, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Nombre del plan"
                    value={p.name}
                    onChange={(e) => setPlan(i, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removePlan(i)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 text-sm text-ink-2 hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted">$</span>
                    <input
                      type="number"
                      className="input w-24"
                      placeholder="Precio"
                      value={p.price || ""}
                      onChange={(e) => setPlan(i, { price: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <input
                    className="input flex-1"
                    placeholder="Detalle (opcional)"
                    value={p.detail}
                    onChange={(e) => setPlan(i, { detail: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <label className="mb-1 block text-xs font-semibold text-ink-2">WhatsApp</label>
        <input className="input mb-3" value={gym.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Instagram (usuario o link)</label>
        <input
          className="input mb-3"
          placeholder="@tugimnasio"
          value={gym.instagram || ""}
          onChange={(e) => set("instagram", e.target.value)}
        />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Dirección</label>
        <input className="input mb-3" value={gym.address || ""} onChange={(e) => set("address", e.target.value)} />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Horarios de atención</label>
        <input
          className="input mb-4"
          placeholder="Lun a Vie 7 a 23 · Sáb 9 a 14"
          value={gym.open_hours || ""}
          onChange={(e) => set("open_hours", e.target.value)}
        />

        <button className="btn btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar y publicar"}
        </button>
        {msg && <p className="mt-3 text-sm text-brand">{msg}</p>}
      </div>

      {/* PREVIEW EN VIVO */}
      <div className="overflow-auto p-6" style={{ "--accent": accent } as React.CSSProperties}>
        <div className="mb-3">
          <p className="text-sm text-ink-2">Vista previa · gymcore.app/{gym.slug || "tu-gym"}</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="relative px-6 py-16 text-center">
            {gym.hero_url && (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-30"
                style={{ backgroundImage: `url(${gym.hero_url})` }}
              />
            )}
            <div className="relative z-10">
              {gym.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={gym.logo_url} alt="" className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover" />
              ) : (
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl text-black" style={{ background: accent }}>
                  💪
                </div>
              )}
              <div className="text-xs font-bold uppercase tracking-[3px]" style={{ color: accent }}>
                {gym.name || "Tu gimnasio"}
              </div>
              <h2 className="mx-auto my-3 max-w-lg text-3xl font-bold">
                {gym.tagline || "Entrená distinto."}
              </h2>
              <p className="mx-auto max-w-md text-ink-2">{gym.description}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-ink-2">
                {gym.whatsapp && <span className="rounded-full border border-white/15 px-3 py-1">💬 WhatsApp</span>}
                {gym.instagram && <span className="rounded-full border border-white/15 px-3 py-1">📷 Instagram</span>}
              </div>
            </div>
          </div>
          {previewSections.map((key) => (
            <PreviewSection key={key} sectionKey={key} gym={gym} plans={plans} accent={accent} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Bloque condensado de preview para una sección opcional de la landing. */
function PreviewSection({
  sectionKey,
  gym,
  plans,
  accent,
}: {
  sectionKey: LandingSectionKey;
  gym: Partial<Gym>;
  plans: MemberPlan[];
  accent: string;
}) {
  if (sectionKey === "beneficios") {
    return (
      <div className="border-t border-white/10 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Beneficios</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(gym.benefits || []).slice(0, 6).map((b, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">{b}</div>
          ))}
        </div>
      </div>
    );
  }
  if (sectionKey === "testimonios") {
    return (
      <div className="border-t border-white/10 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Testimonios</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(gym.testimonials || []).slice(0, 4).map((t, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
              <div className="text-ink-2">“{t.text}”</div>
              <div className="mt-1 font-semibold" style={{ color: accent }}>{t.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (sectionKey === "horarios") {
    return (
      <div className="border-t border-white/10 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Horarios y clases</div>
        <div className="overflow-hidden rounded-lg border border-white/10">
          {(gym.class_schedule || []).slice(0, 6).map((s, i) => (
            <div key={i} className="flex items-center justify-between border-b border-white/5 px-3 py-1.5 text-xs last:border-0">
              <span className="font-medium">{s.day}</span>
              <span className="text-ink-2">{s.time}</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${accent}22`, color: accent }}>{s.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (sectionKey === "galeria") {
    return (
      <div className="border-t border-white/10 p-1">
        <div className="grid grid-cols-3 gap-1 p-1">
          {(gym.gallery || []).slice(0, 6).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="h-24 w-full object-cover" />
          ))}
        </div>
      </div>
    );
  }
  if (sectionKey === "planes") {
    return (
      <div className="border-t border-white/10 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Planes</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {plans.map((p, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-white/10 bg-white/5 text-center">
              <div className="p-3">
                <div className="text-sm font-bold">{p.name || "Plan"}</div>
                <div className="text-lg font-black" style={{ color: accent }}>
                  ${p.price}
                </div>
                {p.detail && <div className="text-[11px] text-muted">{p.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // contacto
  return (
    <div className="border-t border-white/10 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ubicación / Contacto</div>
      <div className="rounded-lg p-3 text-xs text-ink-2" style={{ background: "rgba(255,255,255,.05)" }}>
        {gym.address && <div>📍 {gym.address}</div>}
        {gym.open_hours && <div>🕒 {gym.open_hours}</div>}
        {gym.whatsapp && <div>📱 {gym.whatsapp}</div>}
        {gym.instagram && <div>📷 {gym.instagram}</div>}
      </div>
    </div>
  );
}
