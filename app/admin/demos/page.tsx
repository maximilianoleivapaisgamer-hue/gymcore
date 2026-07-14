"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { removeWhiteBackground } from "@/lib/remove-white-bg";
import { STOCK_GYM } from "@/lib/stock-images";

interface DemoGym { id: string; name: string; slug: string; created_at: string | null; }
interface ImgData { mediaType: string; data: string; name: string; }

const MAX_IMAGES = 10;

/** Lee la imagen y la reduce (máx 1600px, JPEG) para que el pedido no pese de más. */
function fileToBase64(file: File): Promise<{ mediaType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const src = String(r.result || "");
      const rawFallback = () => {
        const comma = src.indexOf(",");
        resolve({ mediaType: file.type || "image/jpeg", data: src.slice(comma + 1) });
      };
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return rawFallback();
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve({ mediaType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1) });
        } catch { rawFallback(); }
      };
      img.onerror = rawFallback;
      img.src = src;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function DemosPage() {
  const supabase = createClient();
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [demos, setDemos] = useState<DemoGym[]>([]);

  // form
  const [nombre, setNombre] = useState("");
  const [instagram, setInstagram] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [website, setWebsite] = useState("");
  const [infoLibre, setInfoLibre] = useState("");
  const [images, setImages] = useState<ImgData[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoNoBg, setLogoNoBg] = useState(true);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  // Google (Apify) + galería
  const [gUrl, setGUrl] = useState("");
  const [gBusy, setGBusy] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);

  const [gen, setGen] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ slug: string; url: string; owner: { email: string; password: string } } | null>(null);

  async function loadDemos() {
    const { data } = await supabase.from("gyms").select("id, name, slug, created_at")
      .eq("is_demo", true).order("created_at", { ascending: false });
    setDemos((data as DemoGym[]) || []);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
        setRole(p?.role || "");
        if (p?.role === "super_admin") await loadDemos();
      }
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  async function uploadImg(file: File, kind: "logo" | "hero") {
    let f = file;
    if (kind === "logo" && logoNoBg) f = await removeWhiteBackground(file);
    const path = `demos/${kind}/${crypto.randomUUID()}-${f.name}`;
    const { error } = await supabase.storage.from("gym-assets").upload(path, f, { upsert: true });
    if (error) { setErr("No se pudo subir la imagen."); return; }
    const { data } = supabase.storage.from("gym-assets").getPublicUrl(path);
    if (kind === "logo") setLogoUrl(data.publicUrl); else setHeroUrl(data.publicUrl);
  }

  const addStock = () => setGallery((prev) => Array.from(new Set([...prev, ...STOCK_GYM.slice(0, 5)])));
  const removeImg = (u: string) => setGallery((prev) => prev.filter((x) => x !== u));

  async function addFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    const arr: ImgData[] = [];
    for (const f of imgs.slice(0, MAX_IMAGES)) {
      const b = await fileToBase64(f);
      arr.push({ ...b, name: f.name || "captura.png" });
    }
    if (arr.length) setImages((prev) => [...prev, ...arr].slice(0, MAX_IMAGES));
  }

  // Pegar capturas con Ctrl+V en cualquier parte de la pantalla.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) { e.preventDefault(); addFiles(files); }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    /* eslint-disable-next-line */
  }, []);

  async function buscarGoogle() {
    setErr("");
    const val = gUrl.trim();
    if (!val) { setErr("Pegá el link de Google Maps o escribí nombre + ciudad."); return; }
    setGBusy(true);
    try {
      const isUrl = /^https?:\/\//i.test(val) || val.includes("google.") || val.includes("maps.app");
      const res = await fetch("/api/admin/demo/google", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(isUrl ? { url: val } : { query: val }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data?.error || "No se pudo leer Google."); setGBusy(false); return; }
      const p = data.place as { name: string; ciudad: string; website: string; address: string; phone: string; horarios: { dia: string; horas: string }[]; images: string[] };
      if (!nombre && p.name) setNombre(p.name);
      if (p.ciudad) setCiudad(p.ciudad);
      if (p.website) setWebsite(p.website);
      const resumen = [
        p.address && `Dirección: ${p.address}`,
        p.phone && `Teléfono: ${p.phone}`,
        p.horarios?.length ? `Horarios: ${p.horarios.map((h) => `${h.dia} ${h.horas}`).join(" · ")}` : "",
      ].filter(Boolean).join("\n");
      if (resumen) setInfoLibre((prev) => (prev ? prev + "\n" + resumen : resumen));
      if (p.images?.length) setGallery((prev) => Array.from(new Set([...prev, ...p.images])));
    } catch { setErr("Falló la conexión con Google/Apify."); }
    setGBusy(false);
  }

  async function generar() {
    setErr(""); setResult(null);
    if (!nombre.trim()) { setErr("Poné al menos el nombre del gimnasio."); return; }
    setGen(true);
    try {
      const res = await fetch("/api/admin/demo/generar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre, instagram, ciudad, website, infoLibre,
          images: images.map((i) => ({ mediaType: i.mediaType, data: i.data })),
          galleryUrls: gallery,
          logoUrl, heroUrl,
          ownerEmail: ownerEmail || undefined, ownerPassword: ownerPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data?.error || "No se pudo generar la demo."); setGen(false); return; }
      setResult({ slug: data.slug, url: data.url, owner: data.owner });
      await loadDemos();
    } catch {
      setErr("Falló la conexión. Probá de nuevo.");
    }
    setGen(false);
  }

  if (loading) return <main className="p-8 text-center text-ink-2">Cargando…</main>;
  if (role !== "super_admin") return <main className="p-8 text-center text-ink-2">Solo el super admin puede generar demos.</main>;

  return (
    <main className="p-5 md:p-7">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-ink-2">
          <Link href="/admin" className="hover:text-brand">Super Admin</Link><span>/</span><span>Demos</span>
        </div>
        <h1 className="text-2xl font-bold">Generador de demos</h1>
        <p className="text-ink-2">Cargá lo que tengas del gimnasio y la IA arma la demo branded (web + panel). No cuenta como cliente real.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div className="card">
          {/* Traer de Google Maps (Apify) */}
          <div className="mb-4 rounded-lg border border-brand/25 bg-[rgba(34,211,238,.06)] p-3">
            <label className="mb-1 block text-xs font-semibold text-brand">🗺️ Traer de Google Maps</label>
            <div className="flex gap-2">
              <input className="input flex-1" value={gUrl} onChange={(e) => setGUrl(e.target.value)}
                placeholder="Pegá el link de Google Maps — o: MegaCenter Gym San Miguel" />
              <button className="btn btn-ghost shrink-0" onClick={buscarGoogle} disabled={gBusy}>{gBusy ? "Buscando…" : "Buscar"}</button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted">Autocompleta ciudad, web, dirección, horarios y trae las fotos del perfil.</p>
              <button type="button" onClick={addStock} className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-[11px] font-semibold hover:bg-white/5">+ Fotos de ejemplo</button>
            </div>

            {gallery.length > 0 && (
              <>
                <p className="mt-2 text-[11px] text-ink-2">{gallery.length} foto(s) en la galería (tocá la ✕ para sacar):</p>
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {gallery.map((u, i) => (
                    <div key={i} className="group relative overflow-hidden rounded-md border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="h-14 w-full object-cover" />
                      <button type="button" onClick={() => removeImg(u)} className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-[10px] text-white">✕</button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="mt-1 text-[10px] text-muted">Si no cargás ninguna, la demo usa 5 fotos de ejemplo para que no quede vacía.</p>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del gimnasio *"><input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: MegaCenter Gym" /></Field>
            <Field label="Instagram (@ o link)"><input className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@megacentergym" /></Field>
            <Field label="Ciudad / zona"><input className="input" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="San Miguel, Bs As" /></Field>
            <Field label="Página web (si tiene)"><input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" /></Field>
          </div>

          <Field label="Contame del gimnasio (lo que sepas: horarios, servicios, estilo…)">
            <textarea className="input" rows={4} value={infoLibre} onChange={(e) => setInfoLibre(e.target.value)}
              placeholder="Ej: gimnasio 24hs en San Miguel, tiene sala de musculación, funcional y clases de spinning. Cuota $18.000. Instagram con logo rojo." />
          </Field>

          <Field label={`Capturas (Instagram / WhatsApp / web) — hasta ${MAX_IMAGES}`}>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files)); }}
              className="mb-2 rounded-lg border border-dashed border-white/20 bg-white/5 p-3 text-center text-xs text-ink-2"
            >
              📋 Sacá la captura y pegala acá con <b>Ctrl+V</b> — o arrastrala — o elegí el archivo:
              <div className="mt-2">
                <input type="file" accept="image/*" multiple className="text-sm" onChange={(e) => e.target.files?.length && addFiles(Array.from(e.target.files))} />
              </div>
            </div>
            {images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {images.map((im, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs">
                    📎 {im.name.slice(0, 18)}
                    <button className="text-crit" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Logo (opcional)">
              <label className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-2">
                <input type="checkbox" checked={logoNoBg} onChange={(e) => setLogoNoBg(e.target.checked)} />
                Quitar fondo blanco (para logos de Instagram)
              </label>
              <input type="file" accept="image/*" className="text-sm" onChange={(e) => e.target.files?.[0] && uploadImg(e.target.files[0], "logo")} />
              {logoUrl && (
                <span className="mt-1 flex items-center gap-2 text-[11px] text-brand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="" className="h-8 w-8 rounded object-contain" style={{ backgroundImage: "linear-gradient(45deg,#333 25%,transparent 25%,transparent 75%,#333 75%),linear-gradient(45deg,#333 25%,#222 25%,#222 75%,#333 75%)", backgroundSize: "8px 8px", backgroundPosition: "0 0,4px 4px" }} />
                  Logo cargado ✓
                </span>
              )}
            </Field>
            <Field label="Foto de fondo (opcional)">
              <input type="file" accept="image/*" className="text-sm" onChange={(e) => e.target.files?.[0] && uploadImg(e.target.files[0], "hero")} />
              {heroUrl && <span className="mt-1 block text-[11px] text-brand">Fondo cargado ✓</span>}
            </Field>
          </div>

          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-ink-2">Login del dueño (opcional — si no, lo genero solo)</summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Email del dueño"><input className="input" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="demo@…" /></Field>
              <Field label="Contraseña"><input className="input" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="mín. 6" /></Field>
            </div>
          </details>

          {err && <p className="mt-3 text-sm text-crit">{err}</p>}
          <button className="btn btn-primary mt-4 w-full" onClick={generar} disabled={gen}>
            {gen ? "Generando con IA… (puede tardar ~20s)" : "🤖 Generar demo con IA"}
          </button>
        </div>

        {/* Resultado + lista */}
        <div className="space-y-4">
          {result && (
            <div className="card border-good/30">
              <div className="mb-2 text-sm font-bold text-good">¡Demo lista! 🎉</div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-xs text-muted">Web pública</div>
                  <a href={result.url} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">turnogym.app{result.url}</a>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                  <div className="text-xs text-muted">Login del panel — usuario y contraseña son <b>iguales</b>:</div>
                  <div className="mt-0.5 break-all font-semibold text-ink">{result.owner.email}</div>
                  <div className="mt-1 text-[11px] text-muted">Entra en turnogym.app/acceso (poné ese texto en usuario y en contraseña).</div>
                </div>
                <p className="text-[11px] text-muted">La demo ya viene con 10 socios, rutinas, dietas, clases y caja cargados. El login del socio lo sumamos en el próximo paso.</p>
              </div>
            </div>
          )}

          <div className="card p-0">
            <div className="border-b border-white/10 p-3 text-sm font-semibold">Demos generadas ({demos.length})</div>
            {demos.length === 0 ? (
              <p className="p-6 text-center text-xs text-ink-2">Todavía no generaste demos.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {demos.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{d.name}</div>
                      <div className="truncate text-[11px] text-muted">/{d.slug}</div>
                    </div>
                    <a href={`/${d.slug}`} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-brand hover:underline">Ver web</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-ink-2">{label}</label>
      {children}
    </div>
  );
}
