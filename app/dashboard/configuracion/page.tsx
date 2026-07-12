"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import type { Gym, MemberPlan } from "@/types/db";

/**
 * Editor de la página pública del gimnasio.
 * El dueño sube su logo, foto de portada y fotos estilo banner (galería),
 * elige color, edita textos, configura sus planes en una lista y agrega
 * WhatsApp e Instagram. Ve el preview en vivo y guarda en Supabase.
 * Las imágenes van al bucket "gym-assets". La landing pública (/[slug]) lee
 * estos mismos datos.
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
      if (data) setGym(data);
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
      })
      .eq("owner_id", user.id);
    setSaving(false);
    setMsg(error ? "No se pudo guardar" : "¡Guardado! Tu página ya está publicada.");
  }

  const accent = gym.accent_color || "#22d3ee";

  return (
    <div className="grid min-h-screen lg:grid-cols-[380px_1fr]">
      {/* EDITOR */}
      <div className="border-r border-white/10 bg-[#0b0f16] p-5">
        <h1 className="mb-4 text-lg font-bold">Configurá tu página</h1>

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
        <input className="input mb-4" value={gym.address || ""} onChange={(e) => set("address", e.target.value)} />

        <button className="btn btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar y publicar"}
        </button>
        {msg && <p className="mt-3 text-sm text-brand">{msg}</p>}
      </div>

      {/* PREVIEW EN VIVO */}
      <div className="overflow-auto p-6" style={{ "--accent": accent } as React.CSSProperties}>
        <p className="mb-3 text-sm text-ink-2">Vista previa · gymcore.app/{gym.slug || "tu-gym"}</p>
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
          {(gym.gallery || []).length > 0 && (
            <div className="grid grid-cols-3 gap-1 p-1">
              {(gym.gallery || []).slice(0, 6).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="h-24 w-full object-cover" />
              ))}
            </div>
          )}
          {(gym.member_plans || []).length > 0 && (
            <div className="grid gap-2 p-4 sm:grid-cols-3">
              {(gym.member_plans || []).map((p, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                  <div className="text-sm font-bold">{p.name || "Plan"}</div>
                  <div className="text-lg font-black" style={{ color: accent }}>${p.price}</div>
                  {p.detail && <div className="text-[11px] text-muted">{p.detail}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
