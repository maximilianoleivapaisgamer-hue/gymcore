"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Gym, MemberPlan } from "@/types/db";

/**
 * Editor de la página pública del gimnasio.
 * El dueño sube su logo y foto de portada, elige color y edita textos/planes,
 * ve el preview en vivo y guarda en Supabase. Las imágenes van al bucket
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

        <label className="mb-1 block text-xs font-semibold text-ink-2">
          Planes (nombre | precio | detalle)
        </label>
        <textarea
          className="input mb-4"
          rows={3}
          value={(gym.member_plans || [])
            .map((p) => `${p.name} | ${p.price} | ${p.detail}`)
            .join("\n")}
          onChange={(e) =>
            set(
              "member_plans",
              e.target.value
                .split("\n")
                .filter(Boolean)
                .map((line): MemberPlan => {
                  const [name, price, detail] = line.split("|").map((s) => s.trim());
                  return { name, price: Number(price) || 0, detail: detail || "" };
                })
            )
          }
        />

        <label className="mb-1 block text-xs font-semibold text-ink-2">WhatsApp</label>
        <input className="input mb-3" value={gym.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} />

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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
