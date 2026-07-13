"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import type { Gym, LandingSectionConfig, LandingTemplate, MemberPlan } from "@/types/db";
import { DEFAULT_LANDING_SECTIONS, LANDING_SECTION_LABELS, LANDING_TEMPLATES } from "@/types/db";
import { combinedLandingPlans, visibleLandingSections } from "@/lib/landing";

/**
 * Editor de la pagina publica del gimnasio.
 * El dueno sube su logo, foto de portada y fotos estilo banner (galeria),
 * elige color, edita textos, configura sus planes en una lista, elige entre
 * las plantillas de landing disponibles y define el orden/visibilidad de las
 * secciones opcionales. Ve el preview en vivo (ya filtrado y ordenado igual
 * que la pagina real) y guarda en Supabase. Las imagenes van al bucket
 * "gym-assets". La landing publica (/[slug]) lee estos mismos datos.
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
    logo_url: null,
    hero_url: null,
    landing_template: "clasica",
    landing_sections: DEFAULT_LANDING_SECTIONS,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Cargar el gimnasio del dueno logueado
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
    setMsg("Subiendo fotos...");
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

  // ---- Plantilla y orden/visibilidad de secciones ----
  const sectionList: LandingSectionConfig[] = gym.landing_sections?.length ? gym.landing_sections : DEFAULT_LANDING_SECTIONS;

  function setTemplate(t: LandingTemplate) {
    set("landing_template", t);
  }

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
        logo_url: gym.logo_url,
        hero_url: gym.hero_url,
        landing_template: gym.landing_template || "clasica",
        landing_sections: sectionList,
      })
      .eq("owner_id", user.id);
    setSaving(false);
    setMsg(error ? "No se pudo guardar" : "Guardado! Tu pagina ya esta publicada.");
  }

  const accent = gym.accent_color || "#22d3ee";
  const template: LandingTemplate = gym.landing_template || "clasica";
  const plans = combinedLandingPlans(gym);
  const previewSections = visibleLandingSections(gym, plans);

  return (
    <div className="grid min-h-screen lg:grid-cols-[380px_1fr]">
      {/* EDITOR */}
      <div className="border-r border-white/10 bg-[#0b0f16] p-5">
        <h1 className="mb-4 text-lg font-bold">Configura tu pagina</h1>

        {/* PLANTILLA */}
        <label className="mb-2 block text-xs font-semibold text-ink-2">Plantilla de la pagina</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {LANDING_TEMPLATES.map((t) => {
            const active = template === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplate(t.key)}
                className={`rounded-xl border p-2 text-left transition ${
                  active ? "border-brand bg-white/5" : "border-white/10 hover:bg-white/5"
                }`}
              >
                <div className="mb-2 overflow-hidden rounded-lg border border-white/10 bg-[#05070b]">
                  {t.key === "clasica" ? (
                    <div className="flex flex-col items-center gap-1.5 p-3">
                      <div className="h-1.5 w-8 rounded-full" style={{ background: accent }} />
                      <div className="h-2.5 w-16 rounded bg-white/25" />
                      <div className="h-1.5 w-20 rounded bg-white/10" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 items-center gap-1.5 p-3">
                      <div className="space-y-1.5">
                        <div className="h-1.5 w-9 rounded bg-white/25" />
                        <div className="h-1.5 w-11 rounded bg-white/10" />
                      </div>
                      <div className="h-9 rounded-md" style={{ background: `${accent}55` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold">
                  {active && <span style={{ color: accent }}>OK</span>}
                  {t.label}
                </div>
                <p className="text-[11px] leading-snug text-muted">{t.description}</p>
              </button>
            );
          })}
        </div>

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
          Fotos estilo banner (galeria)
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
                  x
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

        <label className="mb-1 block text-xs font-semibold text-ink-2">Titulo</label>
        <input className="input mb-3" value={gym.tagline || ""} onChange={(e) => set("tagline", e.target.value)} />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Descripcion</label>
        <textarea
          className="input mb-3"
          rows={3}
          value={gym.description || ""}
          onChange={(e) => set("description", e.target.value)}
        />

        <label className="mb-1 block text-xs font-semibold text-ink-2">Beneficios (uno por linea)</label>
        <textarea
          className="input mb-3"
          rows={3}
          value={(gym.benefits || []).join("\n")}
          onChange={(e) => set("benefits", e.target.value.split("\n").filter(Boolean))}
        />

        {/* ORDEN Y VISIBILIDAD DE SECCIONES */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-semibold text-ink-2">Orden de las secciones</label>
          <p className="mb-2 text-[11px] text-muted">
            El encabezado, la portada y el llamado a la accion final siempre se muestran. Aca elegis en que orden
            aparece el resto, y podes ocultar las que no quieras usar.
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
                    ^
                  </button>
                  <button
                    type="button"
                    disabled={i === sectionList.length - 1}
                    onClick={() => moveSection(i, 1)}
                    className="px-1 text-xs text-ink-2 hover:text-ink disabled:opacity-20"
                    aria-label="Bajar"
                  >
                    v
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

        {/* PLANES - lista editable */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-semibold text-ink-2">Planes de esta pagina</label>
            <button
              type="button"
              onClick={addPlan}
              className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-ink hover:bg-white/5"
            >
              + Agregar plan
            </button>
          </div>
          <p className="mb-2 text-xs text-muted">
            Estos planes son solo para mostrar en tu pagina publica (podes poner precios promocionales). Para los
            planes reales que le cobras a tus socios, configuralos en{" "}
            <Link href="/dashboard/planes" className="text-brand">Planes</Link> - desde ahi tambien podes tildar cuales
            sincronizar automaticamente aca.
          </p>
          {(gym.member_plans || []).length === 0 && (
            <p className="mb-2 text-xs text-muted">Todavia no cargaste planes. Agrega al menos uno.</p>
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
                    x
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

        <label className="mb-1 block text-xs font-semibold text-ink-2">Direccion</label>
        <input className="input mb-4" value={gym.address || ""} onChange={(e) => set("address", e.target.value)} />

        <button className="btn btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? "Guardando..." : "Guardar y publicar"}
        </button>
        {msg && <p className="mt-3 text-sm text-brand">{msg}</p>}
      </div>

      {/* PREVIEW EN VIVO */}
      <div className="overflow-auto p-6" style={{ "--accent": accent } as React.CSSProperties}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-ink-2">Vista previa - gymcore.app/{gym.slug || "tu-gym"}</p>
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-muted">
            Plantilla {LANDING_TEMPLATES.find((t) => t.key === template)?.label}
          </span>
        </div>

        {template === "clasica" ? (
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
                    GYM
                  </div>
                )}
                <div className="text-xs font-bold uppercase tracking-[3px]" style={{ color: accent }}>
                  {gym.name || "Tu gimnasio"}
                </div>
                <h2 className="mx-auto my-3 max-w-lg text-3xl font-bold">
                  {gym.tagline || "Entrena distinto."}
                </h2>
                <p className="mx-auto max-w-md text-ink-2">{gym.description}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-ink-2">
                  {gym.whatsapp && <span className="rounded-full border border-white/15 px-3 py-1">WhatsApp</span>}
                  {gym.instagram && <span className="rounded-full border border-white/15 px-3 py-1">Instagram</span>}
                </div>
              </div>
            </div>
            {previewSections.map((key) => (
              <PreviewSection key={key} sectionKey={key} gym={gym} plans={plans} accent={accent} variant="clasica" />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="h-1 w-full" style={{ background: accent }} />
            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:items-center">
              <div>
                <div
                  className="mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[2px]"
                  style={{ color: accent, borderColor: `${accent}55` }}
                >
                  {gym.name || "Tu gimnasio"}
                </div>
                <h2 className="max-w-sm text-2xl font-bold">{gym.tagline || "Entrena distinto."}</h2>
                <p className="mt-2 max-w-sm text-sm text-ink-2">{gym.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-2">
                  {gym.whatsapp && <span className="rounded-full border border-white/15 px-3 py-1">WhatsApp</span>}
                  {gym.instagram && <span className="rounded-full border border-white/15 px-3 py-1">Instagram</span>}
                </div>
              </div>
              <div className="aspect-[4/3] overflow-hidden rounded-2xl border-2" style={{ borderColor: `${accent}55` }}>
                {gym.hero_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gym.hero_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="grid h-full w-full place-items-center text-4xl"
                    style={{ background: `linear-gradient(135deg, ${accent}55, rgba(255,255,255,.05))` }}
                  >
                    GYM
                  </div>
                )}
              </div>
            </div>
            {previewSections.map((key) => (
              <PreviewSection key={key} sectionKey={key} gym={gym} plans={plans} accent={accent} variant="moderna" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Bloque condensado de preview para una seccion opcional, con un estilo
 * levemente distinto segun la plantilla activa (variant). */
function PreviewSection({
  sectionKey,
  gym,
  plans,
  accent,
  variant,
}: {
  sectionKey: "beneficios" | "galeria" | "planes" | "contacto";
  gym: Partial<Gym>;
  plans: MemberPlan[];
  accent: string;
  variant: "clasica" | "moderna";
}) {
  if (sectionKey === "beneficios") {
    return (
      <div className="border-t border-white/10 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Beneficios</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(gym.benefits || []).slice(0, 6).map((b, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
              {variant === "moderna" && (
                <div className="mb-1 text-sm font-black" style={{ color: accent }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
              )}
              {b}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (sectionKey === "galeria") {
    return (
      <div className="border-t border-white/10 p-1">
        <div
          className={variant === "moderna" ? "flex gap-1 overflow-x-auto p-3" : "grid grid-cols-3 gap-1 p-1"}
        >
          {(gym.gallery || []).slice(0, 6).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className={variant === "moderna" ? "h-20 w-24 shrink-0 rounded-lg object-cover" : "h-24 w-full object-cover"}
            />
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
              {variant === "moderna" && <div className="h-1" style={{ background: accent }} />}
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
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Ubicacion / Contacto</div>
      <div
        className="rounded-lg p-3 text-xs text-ink-2"
        style={{ background: variant === "moderna" ? `${accent}1a` : "rgba(255,255,255,.05)" }}
      >
        {gym.address && <div>{gym.address}</div>}
        {gym.whatsapp && <div>{gym.whatsapp}</div>}
        {gym.instagram && <div>{gym.instagram}</div>}
      </div>
    </div>
  );
}
