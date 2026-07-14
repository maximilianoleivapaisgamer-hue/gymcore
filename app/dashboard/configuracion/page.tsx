"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import type { Gym } from "@/types/db";
import { THEMES, BG_STYLES } from "@/lib/theme";
import ThemeApply from "@/components/ThemeApply";
import ShareGym from "@/components/ShareGym";
import {
  resolveLandingConfig,
  DEFAULT_LANDING,
  type LandingConfig,
  type LBenefit,
  type LClass,
  type LPlan,
  type LHorario,
} from "@/lib/landing-config";
import { Icon, BENEFIT_ICONS } from "@/components/landing/site/Icon";
import LandingSite from "@/components/landing/site/LandingSite";
import "../../(public)/landing.css";

/**
 * Editor de la página pública (plantilla definitiva). El dueño edita el
 * contenido de su landing y lo ve en vivo con el mismo diseño publicado.
 * La identidad (nombre, color, logo, fondo, contacto, dirección) se guarda en
 * las columnas del gym; el contenido rico (beneficios, clases, planes, galería,
 * ubicación, redes, secciones) en gym.landing_config.
 */
export default function ConfiguracionPage() {
  const supabase = createClient();
  const [gymId, setGymId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [theme, setTheme] = useState("celeste");
  const [bgStyle, setBgStyle] = useState("aurora");
  const [cfg, setCfg] = useState<LandingConfig>(DEFAULT_LANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("gyms").select("*").eq("owner_id", user.id).single<Gym>();
      if (data) {
        setGymId(data.id);
        setSlug(data.slug || "");
        setTheme(data.theme || "celeste");
        setBgStyle(data.bg_style || "aurora");
        setCfg(resolveLandingConfig(data));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- helpers de edición ----
  const patch = (p: Partial<LandingConfig>) => setCfg((c) => ({ ...c, ...p }));
  const patchMarca = (p: Partial<LandingConfig["marca"]>) => setCfg((c) => ({ ...c, marca: { ...c.marca, ...p } }));
  const patchUbic = (p: Partial<LandingConfig["ubicacion"]>) => setCfg((c) => ({ ...c, ubicacion: { ...c.ubicacion, ...p } }));
  const patchSecc = (p: Partial<LandingConfig["secciones"]>) => setCfg((c) => ({ ...c, secciones: { ...c.secciones, ...p } }));

  async function uploadImage(file: File, kind: "logo" | "hero") {
    setMsg("Subiendo imagen…");
    const path = `${kind}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from("gym-assets").upload(path, file, { upsert: true });
    if (error) { setMsg("Error al subir la imagen"); return; }
    const { data } = supabase.storage.from("gym-assets").getPublicUrl(path);
    if (kind === "logo") patch({ logoUrl: data.publicUrl });
    else patch({ heroImagen: data.publicUrl });
    setMsg("");
  }

  async function uploadGallery(files: FileList) {
    setMsg("Subiendo fotos…");
    const nuevas: { src: string; alt: string }[] = [];
    for (const file of Array.from(files)) {
      const path = `gallery/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("gym-assets").upload(path, file, { upsert: true });
      if (error) { setMsg("Error al subir una foto"); continue; }
      const { data } = supabase.storage.from("gym-assets").getPublicUrl(path);
      nuevas.push({ src: data.publicUrl, alt: cfg.nombre });
    }
    setCfg((c) => ({ ...c, galeria: [...c.galeria, ...nuevas] }));
    setMsg("");
  }
  const removeFoto = (i: number) => setCfg((c) => ({ ...c, galeria: c.galeria.filter((_, idx) => idx !== i) }));

  // Beneficios
  const addBenef = () => setCfg((c) => ({ ...c, beneficios: [...c.beneficios, { icon: "Dumbbell", titulo: "Nuevo beneficio", texto: "" }] }));
  const setBenef = (i: number, p: Partial<LBenefit>) => setCfg((c) => ({ ...c, beneficios: c.beneficios.map((b, idx) => (idx === i ? { ...b, ...p } : b)) }));
  const delBenef = (i: number) => setCfg((c) => ({ ...c, beneficios: c.beneficios.filter((_, idx) => idx !== i) }));

  // Clases
  const addClase = () => setCfg((c) => ({ ...c, clases: [...c.clases, { nombre: "", dias: "", horario: "", cupo: undefined }] }));
  const setClase = (i: number, p: Partial<LClass>) => setCfg((c) => ({ ...c, clases: c.clases.map((x, idx) => (idx === i ? { ...x, ...p } : x)) }));
  const delClase = (i: number) => setCfg((c) => ({ ...c, clases: c.clases.filter((_, idx) => idx !== i) }));

  // Planes
  const addPlan = () => setCfg((c) => ({ ...c, planes: [...c.planes, { nombre: "", precio: 0, periodo: "mes", incluye: [], destacado: false }] }));
  const setPlan = (i: number, p: Partial<LPlan>) => setCfg((c) => ({ ...c, planes: c.planes.map((x, idx) => (idx === i ? { ...x, ...p } : x)) }));
  const delPlan = (i: number) => setCfg((c) => ({ ...c, planes: c.planes.filter((_, idx) => idx !== i) }));

  // Horarios de ubicación
  const addHorario = () => setCfg((c) => ({ ...c, ubicacion: { ...c.ubicacion, horarios: [...c.ubicacion.horarios, { dia: "", horas: "" }] } }));
  const setHorario = (i: number, p: Partial<LHorario>) => setCfg((c) => ({ ...c, ubicacion: { ...c.ubicacion, horarios: c.ubicacion.horarios.map((h, idx) => (idx === i ? { ...h, ...p } : h)) } }));
  const delHorario = (i: number) => setCfg((c) => ({ ...c, ubicacion: { ...c.ubicacion, horarios: c.ubicacion.horarios.filter((_, idx) => idx !== i) } }));

  async function save() {
    if (!gymId) return;
    setSaving(true); setMsg("");
    const { error } = await supabase.from("gyms").update({
      name: cfg.nombre,
      slug,
      accent_color: cfg.marca.primary,
      theme,
      bg_style: bgStyle,
      tagline: cfg.tagline,
      description: cfg.descripcion,
      whatsapp: cfg.whatsapp,
      address: cfg.ubicacion.direccion,
      instagram: cfg.instagram,
      logo_url: cfg.logoUrl,
      hero_url: cfg.heroImagen,
      landing_config: cfg,
    }).eq("id", gymId);
    setSaving(false);
    setMsg(error ? "No se pudo guardar." : "¡Guardado! Tu página ya está publicada.");
  }

  if (loading) return <main className="p-8 text-center text-ink-2">Cargando…</main>;

  return (
    <div className="grid min-h-screen lg:grid-cols-[400px_1fr]">
      <ThemeApply theme={theme} />

      {/* EDITOR */}
      <div className="max-h-screen overflow-y-auto border-r border-white/10 bg-[#0b0f16] p-5">
        <h1 className="mb-1 text-lg font-bold">Configurá tu página</h1>
        <p className="mb-5 text-xs text-muted">Editá el contenido y mirá el resultado en vivo a la derecha.</p>

        <Section title="Marca y colores">
          <label className="mb-2 block text-xs font-semibold text-ink-2">Color principal</label>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {THEMES.map((t) => (
              <button key={t.key} type="button" title={t.label}
                onClick={() => { setTheme(t.key); patchMarca({ primary: t.hex }); }}
                className={`h-8 w-8 rounded-full border-2 transition ${cfg.marca.primary.toLowerCase() === t.hex.toLowerCase() ? "scale-110 border-white" : "border-white/20 hover:border-white/50"}`}
                style={{ background: t.hex }} />
            ))}
            <input type="color" value={cfg.marca.primary} onChange={(e) => patchMarca({ primary: e.target.value })} className="h-8 w-12 rounded" title="Color personalizado" />
          </div>

          <label className="mb-1 block text-xs font-semibold text-ink-2">Color secundario</label>
          <input type="color" value={cfg.marca.secondary || cfg.marca.primary} onChange={(e) => patchMarca({ secondary: e.target.value })} className="mb-3 h-8 w-12 rounded" />

          <label className="mb-1 block text-xs font-semibold text-ink-2">Modo de la página</label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => patchMarca({ dark: false })}
              className={`rounded-lg border p-2 text-xs font-semibold transition ${!cfg.marca.dark ? "border-brand bg-white/5 text-brand" : "border-white/10 text-ink-2"}`}>☀️ Claro</button>
            <button type="button" onClick={() => patchMarca({ dark: true })}
              className={`rounded-lg border p-2 text-xs font-semibold transition ${cfg.marca.dark ? "border-brand bg-white/5 text-brand" : "border-white/10 text-ink-2"}`}>🌙 Oscuro</button>
          </div>

          <label className="mb-1 block text-xs font-semibold text-ink-2">Fondo del panel (interno)</label>
          <div className="grid grid-cols-3 gap-2">
            {BG_STYLES.map((b) => (
              <button key={b.key} type="button" onClick={() => setBgStyle(b.key)}
                className={`rounded-lg border p-2 text-left transition ${bgStyle === b.key ? "border-brand bg-white/5" : "border-white/10 hover:bg-white/5"}`}>
                <div className="text-xs font-semibold">{b.label}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Logo y fondo">
          <label className="mb-1 block text-xs font-semibold text-ink-2">Logo del gimnasio</label>
          <input type="file" accept="image/*" className="mb-2 text-sm" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "logo")} />
          {cfg.logoUrl && (
            <div className="mb-3 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
              <button className="text-xs text-crit hover:underline" onClick={() => patch({ logoUrl: null })}>Quitar</button>
            </div>
          )}
          <label className="mb-1 block text-xs font-semibold text-ink-2">Imagen de fondo (hero)</label>
          <p className="mb-1 text-[11px] text-muted">Esta es la foto que se ve detrás del título arriba de todo.</p>
          <input type="file" accept="image/*" className="mb-2 text-sm" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "hero")} />
          {cfg.heroImagen && (
            <div className="mb-1 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.heroImagen} alt="" className="h-14 w-24 rounded-lg object-cover" />
              <button className="text-xs text-crit hover:underline" onClick={() => patch({ heroImagen: null })}>Quitar</button>
            </div>
          )}
        </Section>

        <Section title="Encabezado">
          <Field label="Nombre del gimnasio"><input className="input" value={cfg.nombre} onChange={(e) => patch({ nombre: e.target.value })} /></Field>
          <Field label="Dirección de la página (slug)"><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></Field>
          <Field label="Frase principal (tagline)"><input className="input" value={cfg.tagline} onChange={(e) => patch({ tagline: e.target.value })} /></Field>
          <Field label="Descripción"><textarea className="input" rows={3} value={cfg.descripcion} onChange={(e) => patch({ descripcion: e.target.value })} /></Field>
        </Section>

        <Section title="Contacto y redes">
          <Field label="WhatsApp (solo números, con país)"><input className="input" placeholder="5491122334455" value={cfg.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value })} /></Field>
          <Field label="Email"><input className="input" value={cfg.email} onChange={(e) => patch({ email: e.target.value })} /></Field>
          <Field label="Teléfono"><input className="input" value={cfg.telefono} onChange={(e) => patch({ telefono: e.target.value })} /></Field>
          <Field label="Instagram (usuario o link)"><input className="input" placeholder="@tugimnasio" value={cfg.instagram} onChange={(e) => patch({ instagram: e.target.value })} /></Field>
          <Field label="Facebook (link)"><input className="input" value={cfg.facebook} onChange={(e) => patch({ facebook: e.target.value })} /></Field>
          <Field label="TikTok (link)"><input className="input" value={cfg.tiktok} onChange={(e) => patch({ tiktok: e.target.value })} /></Field>
        </Section>

        <Section title="Ubicación (siempre visible)">
          <Field label="Dirección"><input className="input" value={cfg.ubicacion.direccion} onChange={(e) => patchUbic({ direccion: e.target.value })} /></Field>
          <Field label="Ciudad"><input className="input" value={cfg.ubicacion.ciudad} onChange={(e) => patchUbic({ ciudad: e.target.value })} /></Field>
          <Field label="Búsqueda en Google Maps">
            <input className="input" value={cfg.ubicacion.mapsQuery} onChange={(e) => patchUbic({ mapsQuery: e.target.value })} />
            <p className="mt-1 text-[11px] text-muted">Lo que se escribe acá se usa para el mapa. Ej: “Av. Corrientes 4521, CABA”.</p>
          </Field>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-2">Horarios de atención</span>
            <button type="button" onClick={addHorario} className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/5">+ Agregar</button>
          </div>
          <div className="space-y-2">
            {cfg.ubicacion.horarios.map((h, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
                <input className="input flex-1" placeholder="Días (ej: Lun a Vie)" value={h.dia} onChange={(e) => setHorario(i, { dia: e.target.value })} />
                <input className="input w-32" placeholder="06:00 – 23:00" value={h.horas} onChange={(e) => setHorario(i, { horas: e.target.value })} />
                <RemoveBtn onClick={() => delHorario(i)} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Beneficios" toggle={{ on: cfg.secciones.beneficios, set: (v) => patchSecc({ beneficios: v }) }}>
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={addBenef} className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/5">+ Agregar tarjeta</button>
          </div>
          <div className="space-y-3">
            {cfg.beneficios.map((b, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted">Tarjeta {i + 1}</span>
                  <RemoveBtn onClick={() => delBenef(i)} />
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {BENEFIT_ICONS.map((name) => (
                    <button key={name} type="button" onClick={() => setBenef(i, { icon: name })} title={name}
                      className={`grid h-8 w-8 place-items-center rounded-lg border transition ${b.icon === name ? "border-brand text-brand" : "border-white/10 text-ink-2 hover:bg-white/5"}`}>
                      <Icon name={name} className="h-4 w-4" />
                    </button>
                  ))}
                </div>
                <input className="input mb-1.5" placeholder="Título" value={b.titulo} onChange={(e) => setBenef(i, { titulo: e.target.value })} />
                <textarea className="input" rows={2} placeholder="Descripción" value={b.texto} onChange={(e) => setBenef(i, { texto: e.target.value })} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Clases" toggle={{ on: cfg.secciones.clases, set: (v) => patchSecc({ clases: v }) }}>
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={addClase} className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/5">+ Agregar clase</button>
          </div>
          <div className="space-y-2">
            {cfg.clases.map((c, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <input className="input flex-1" placeholder="Nombre (ej: Funcional)" value={c.nombre} onChange={(e) => setClase(i, { nombre: e.target.value })} />
                  <RemoveBtn onClick={() => delClase(i)} />
                </div>
                <div className="flex gap-1.5">
                  <input className="input flex-1" placeholder="Días" value={c.dias} onChange={(e) => setClase(i, { dias: e.target.value })} />
                  <input className="input flex-1" placeholder="Horarios" value={c.horario} onChange={(e) => setClase(i, { horario: e.target.value })} />
                  <input className="input w-16" type="number" placeholder="Cupo" value={c.cupo ?? ""} onChange={(e) => setClase(i, { cupo: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Planes" toggle={{ on: cfg.secciones.planes, set: (v) => patchSecc({ planes: v }) }}>
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={addPlan} className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/5">+ Agregar plan</button>
          </div>
          <div className="space-y-3">
            {cfg.planes.map((p, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <input className="input flex-1" placeholder="Nombre del plan" value={p.nombre} onChange={(e) => setPlan(i, { nombre: e.target.value })} />
                  <RemoveBtn onClick={() => delPlan(i)} />
                </div>
                <div className="mb-1.5 flex gap-1.5">
                  <div className="flex items-center gap-1"><span className="text-sm text-muted">$</span>
                    <input className="input w-24" type="number" placeholder="Precio" value={p.precio || ""} onChange={(e) => setPlan(i, { precio: Number(e.target.value) || 0 })} />
                  </div>
                  <input className="input flex-1" placeholder="Período (ej: mes)" value={p.periodo} onChange={(e) => setPlan(i, { periodo: e.target.value })} />
                </div>
                <textarea className="input mb-1.5" rows={3} placeholder="Qué incluye (uno por línea)"
                  value={p.incluye.join("\n")} onChange={(e) => setPlan(i, { incluye: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
                <label className="flex items-center gap-2 text-xs text-ink-2">
                  <input type="checkbox" checked={!!p.destacado} onChange={(e) => setPlan(i, { destacado: e.target.checked })} /> Destacado (recomendado)
                </label>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Galería" toggle={{ on: cfg.secciones.galeria, set: (v) => patchSecc({ galeria: v }) }}>
          <input type="file" accept="image/*" multiple className="mb-2 text-sm" onChange={(e) => e.target.files?.length && uploadGallery(e.target.files)} />
          {cfg.galeria.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {cfg.galeria.map((g, i) => (
                <div key={i} className="group relative overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.src} alt="" className="h-16 w-full object-cover" />
                  <button type="button" onClick={() => removeFoto(i)} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-xs text-white opacity-0 transition group-hover:opacity-100">✕</button>
                </div>
              ))}
            </div>
          )}
          {cfg.galeria.length === 0 && <p className="text-[11px] text-muted">Sin fotos, la sección no aparece.</p>}
        </Section>

        <button className="btn btn-primary mt-2 w-full" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar y publicar"}
        </button>
        {msg && <p className="mt-3 text-sm text-brand">{msg}</p>}
      </div>

      {/* PREVIEW EN VIVO */}
      <div className="max-h-screen overflow-y-auto bg-[#0a0d12] p-5">
        <ShareGym slug={slug || ""} gymName={cfg.nombre} />
        <p className="mb-3 text-sm text-ink-2">Vista previa · turnogym.app/{slug || "tu-gym"}</p>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <LandingSite config={cfg} slug={slug || "tu-gym"} preview />
        </div>
      </div>
    </div>
  );
}

// ---- subcomponentes de UI del editor ----
function Section({ title, children, toggle }: { title: string; children: React.ReactNode; toggle?: { on: boolean; set: (v: boolean) => void } }) {
  return (
    <div className="mb-5 border-b border-white/10 pb-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">{title}</h2>
        {toggle && (
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={toggle.on} onChange={(e) => toggle.set(e.target.checked)} /> Mostrar
          </label>
        )}
      </div>
      {(!toggle || toggle.on) && children}
      {toggle && !toggle.on && <p className="text-[11px] text-muted">Sección oculta en tu página.</p>}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-ink-2">{label}</label>
      {children}
    </div>
  );
}
function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 text-sm text-ink-2 hover:bg-white/5" aria-label="Quitar">✕</button>
  );
}
