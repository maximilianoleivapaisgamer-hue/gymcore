"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { removeWhiteBackground } from "@/lib/remove-white-bg";
import { dominantColor } from "@/lib/dominant-color";
import { STOCK_GYM } from "@/lib/stock-images";

interface DemoGym { id: string; name: string; slug: string; created_at: string | null; demo_suspended?: boolean; }
interface ImgData { mediaType: string; data: string; name: string; }
interface AccInfo { slug: string; name: string; owner: { user: string; url: string }; socio: { name: string; user: string; url: string } | null; }

function origin() { return typeof window !== "undefined" ? window.location.origin : "https://turnogym.com"; }
function messageFor(info: AccInfo): string {
  const o = origin();
  const lines = [
    "¡Hola! Te dejo tu gimnasio ya armado en turnogym 💪",
    "",
    `🌐 Tu web: ${o}/${info.slug}`,
    "",
    `🖥️ Panel de gestión (para vos): ${o}${info.owner.url}`,
    `Usuario y contraseña: ${info.owner.user}`,
  ];
  if (info.socio) {
    lines.push("", `📲 App para tus socios: ${o}${info.socio.url}`, `Usuario y contraseña: ${info.socio.user}`);
  }
  lines.push("", "Entrá, probalo y cualquier duda me escribís. ¡Que lo disfrutes!");
  return lines.join("\n");
}

function CopyBtn({ text, label = "Copiar", full = false }: { text: string; label?: string; full?: boolean }) {
  const [ok, setOk] = useState(false);
  const cls = full
    ? "btn btn-primary w-full text-xs"
    : "shrink-0 rounded-md border border-white/15 px-2 py-0.5 text-[11px] font-semibold hover:bg-white/5";
  return (
    <button type="button" className={cls}
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); })}>
      {ok ? "✓ Copiado" : label}
    </button>
  );
}

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
  const [brandColor, setBrandColor] = useState<string>("");

  // Google (Apify) + galería
  const [gUrl, setGUrl] = useState("");
  const [gBusy, setGBusy] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [heroPick, setHeroPick] = useState<string>("");

  // Accesos por demo (panel desplegable en la lista)
  const [openId, setOpenId] = useState<string | null>(null);
  const [acc, setAcc] = useState<Record<string, AccInfo>>({});
  const [accBusy, setAccBusy] = useState<string | null>(null);
  // Gestión (suspender / editar / regenerar)
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState(""); const [eTag, setETag] = useState(""); const [eDesc, setEDesc] = useState(""); const [eColor, setEColor] = useState("#22d3ee");
  // Convertir en cliente
  const [convId, setConvId] = useState<string | null>(null);
  const [cPlan, setCPlan] = useState("basico"); const [cStatus, setCStatus] = useState("trial");

  const [gen, setGen] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ slug: string; url: string; owner: { user: string; loginUrl: string }; socio: { name: string; user: string; loginUrl: string } | null } | null>(null);

  async function loadDemos() {
    const { data } = await supabase.from("gyms").select("id, name, slug, created_at, demo_suspended")
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
    if (kind === "logo") {
      // Detectar el color de marca del logo original (antes de quitar el fondo).
      const c = await dominantColor(file);
      if (c) setBrandColor(c);
      if (logoNoBg) f = await removeWhiteBackground(file);
    }
    const path = `demos/${kind}/${crypto.randomUUID()}-${f.name}`;
    const { error } = await supabase.storage.from("gym-assets").upload(path, f, { upsert: true });
    if (error) { setErr("No se pudo subir la imagen."); return; }
    const { data } = supabase.storage.from("gym-assets").getPublicUrl(path);
    if (kind === "logo") setLogoUrl(data.publicUrl); else setHeroUrl(data.publicUrl);
  }

  const addStock = () => setGallery((prev) => Array.from(new Set([...prev, ...STOCK_GYM.slice(0, 5)])));
  const removeImg = (u: string) => { setGallery((prev) => prev.filter((x) => x !== u)); setHeroPick((h) => (h === u ? "" : h)); };

  async function toggleAcc(d: DemoGym) {
    if (openId === d.id) { setOpenId(null); return; }
    setOpenId(d.id);
    if (!acc[d.id]) {
      setAccBusy(d.id);
      try {
        const res = await fetch("/api/admin/demo/acceso", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ gymId: d.id }),
        });
        const data = await res.json();
        if (data.ok) setAcc((a) => ({ ...a, [d.id]: data as AccInfo }));
      } catch { /* noop */ }
      setAccBusy(null);
    }
  }

  async function gestion(action: string, payload: Record<string, unknown>) {
    const res = await fetch("/api/admin/demo/gestion", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    return res.json();
  }
  async function suspender(d: DemoGym, suspended: boolean) {
    setBusyId(d.id);
    const data = await gestion("suspender", { gymId: d.id, suspended }).catch(() => null);
    setBusyId(null);
    if (data?.ok) setDemos((ds) => ds.map((x) => (x.id === d.id ? { ...x, demo_suspended: suspended } : x)));
    else alert(data?.error || "No se pudo cambiar el estado.");
  }
  function startEdit(d: DemoGym) {
    if (editId === d.id) { setEditId(null); return; }
    setEditId(d.id); setOpenId(null);
    setEName(d.name); setETag(""); setEDesc(""); setEColor("#22d3ee");
  }
  async function guardarEdit(d: DemoGym) {
    setBusyId(d.id);
    const data = await gestion("actualizar", {
      gymId: d.id, name: eName,
      tagline: eTag || undefined, descripcion: eDesc || undefined,
      brandColor: /^#[0-9a-fA-F]{6}$/.test(eColor) ? eColor : undefined,
    }).catch(() => null);
    setBusyId(null);
    if (data?.ok) { setDemos((ds) => ds.map((x) => (x.id === d.id ? { ...x, name: eName || x.name } : x))); setEditId(null); }
    else alert(data?.error || "No se pudo guardar.");
  }
  async function regenerar(d: DemoGym) {
    if (!confirm(`¿Regenerar los textos de "${d.name}" con IA? Se reescriben frase, beneficios, clases y planes (se mantienen marca, fotos y accesos).`)) return;
    setBusyId(d.id);
    const data = await gestion("regenerar", { gymId: d.id }).catch(() => null);
    setBusyId(null);
    if (!data?.ok) alert(data?.error || "No se pudo regenerar.");
    else alert("✓ Textos regenerados. Abrí la web para verlos.");
  }

  function startConvert(d: DemoGym) {
    if (convId === d.id) { setConvId(null); return; }
    setConvId(d.id); setEditId(null); setOpenId(null);
    setCPlan("basico"); setCStatus("trial");
  }
  async function convertir(d: DemoGym) {
    if (!confirm(`¿Convertir "${d.name}" en cliente real? Deja de ser demo y (según el ajuste de Cobros) se limpian los datos de ejemplo. Se mantiene la web y la marca.`)) return;
    setBusyId(d.id);
    const res = await fetch("/api/admin/demo/convertir", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ gymId: d.id, plan: cPlan, status: cStatus }),
    }).then((r) => r.json()).catch(() => null);
    setBusyId(null);
    if (res?.ok) {
      setDemos((ds) => ds.filter((x) => x.id !== d.id)); // ya no es demo
      setConvId(null);
      alert("✓ Convertido en cliente. Aparece en el Dashboard de gimnasios.");
    } else {
      alert(res?.error || "No se pudo convertir.");
    }
  }

  async function eliminar(d: DemoGym) {
    if (!confirm(`¿Eliminar la demo "${d.name}"? Se borra el gimnasio, sus datos y los accesos. No se puede deshacer.`)) return;
    try {
      const res = await fetch("/api/admin/demo/eliminar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ gymId: d.id }),
      });
      const data = await res.json();
      if (data.ok) setDemos((ds) => ds.filter((x) => x.id !== d.id));
      else alert(data.error || "No se pudo eliminar.");
    } catch { alert("Falló la conexión."); }
  }

  async function addFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    // Si todavía no hay color de marca, lo sacamos de la primera captura.
    if (imgs[0]) { const c = await dominantColor(imgs[0]); if (c) setBrandColor((prev) => prev || c); }
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
      const res = await fetch("/api/admin/demo/google", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: val }),
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
          heroPick: heroPick || undefined,
          brandColor: brandColor || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data?.error || "No se pudo generar la demo."); setGen(false); return; }
      setResult({ slug: data.slug, url: data.url, owner: data.owner, socio: data.socio ?? null });
      await loadDemos();
    } catch {
      setErr("Falló la conexión. Probá de nuevo.");
    }
    setGen(false);
  }

  if (loading) return <main className="p-8 text-center text-ink-2">Cargando…</main>;
  if (role !== "super_admin") return <main className="p-8 text-center text-ink-2">Solo el super admin puede generar demos.</main>;

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Generador de demos</h1>
        <p className="text-ink-2">Cargá lo que tengas del gimnasio y la IA arma la demo branded (web + panel). No cuenta como cliente real.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div className="card">
          {/* Traer de Google Maps (Apify) */}
          <div className="mb-4 rounded-lg border border-brand/25 bg-[rgba(34,211,238,.06)] p-3">
            <label className="mb-1 block text-xs font-semibold text-brand">🗺️ Traer de Google Maps</label>
            <div className="flex gap-2">
              <input className="input flex-1" value={gUrl} onChange={(e) => setGUrl(e.target.value)}
                placeholder="Escribí: MegaCenter Gym San Miguel — o pegá el link de Maps" />
              <button className="btn btn-ghost shrink-0" onClick={buscarGoogle} disabled={gBusy}>{gBusy ? "Buscando…" : "Buscar"}</button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted">Autocompleta ciudad, web, dirección, horarios y trae las fotos del perfil.</p>
              <button type="button" onClick={addStock} className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-[11px] font-semibold hover:bg-white/5">+ Fotos de ejemplo</button>
            </div>

            {gallery.length > 0 && (
              <>
                <p className="mt-2 text-[11px] text-ink-2">{gallery.length} foto(s). Tocá <b>“Fondo”</b> para elegir la del hero, o la ✕ para sacar:</p>
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {gallery.map((u, i) => {
                    const isHero = heroPick ? heroPick === u : i === 0;
                    return (
                      <div key={i} className={`group relative overflow-hidden rounded-md border-2 ${isHero ? "border-brand" : "border-white/10"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="" className="h-14 w-full object-cover" />
                        <button type="button" onClick={() => setHeroPick(u)}
                          className={`absolute left-0.5 top-0.5 rounded px-1 text-[9px] font-bold ${isHero ? "bg-brand text-[#04121a]" : "bg-black/70 text-white"}`}>
                          {isHero ? "★ Fondo" : "Fondo"}
                        </button>
                        <button type="button" onClick={() => removeImg(u)} className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-[10px] text-white">✕</button>
                      </div>
                    );
                  })}
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

          <Field label={`Color de marca ${brandColor ? "(detectado del logo/captura — ajustalo si querés)" : "(se detecta del logo/captura, o elegilo a mano)"}`}>
            <div className="flex items-center gap-2">
              <input type="color" value={brandColor || "#22d3ee"} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-14 rounded" />
              <span className="rounded-md px-2 py-1 text-xs font-semibold" style={{ background: brandColor || "#22d3ee", color: "#000" }}>{brandColor || "sin detectar"}</span>
            </div>
          </Field>

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
                  <div className="text-xs text-muted">🌐 Web pública</div>
                  <a href={result.url} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">{origin()}{result.url}</a>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <div className="text-xs font-semibold text-ink-2">👤 Panel del dueño</div>
                  <div className="mt-1 text-xs text-muted">Link:</div>
                  <a href={result.owner.loginUrl} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">{origin()}{result.owner.loginUrl}</a>
                  <div className="mt-1.5 text-xs text-muted">Usuario y contraseña (iguales):</div>
                  <div className="text-base font-bold text-ink">{result.owner.user}</div>
                </div>

                {result.socio && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                    <div className="text-xs font-semibold text-ink-2">📲 App del socio ({result.socio.name})</div>
                    <div className="mt-1 text-xs text-muted">Link (con el logo del gimnasio):</div>
                    <a href={result.socio.loginUrl} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">{origin()}{result.socio.loginUrl}</a>
                    <div className="mt-1.5 text-xs text-muted">Usuario y contraseña (iguales):</div>
                    <div className="text-base font-bold text-ink">{result.socio.user}</div>
                  </div>
                )}
                <p className="text-[11px] text-muted">Poné el mismo texto en usuario y en contraseña. La demo viene con 10 socios, rutinas, dietas, clases y caja.</p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Demos generadas — formato lista, como los clientes */}
      <div className="mt-6 card p-0">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <span className="text-sm font-semibold">Demos generadas ({demos.length})</span>
        </div>
        {demos.length === 0 ? (
          <p className="p-8 text-center text-ink-2">Todavía no generaste demos.</p>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_120px_110px_minmax(0,2.4fr)] gap-3 border-b border-white/10 px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted md:grid">
              <span>Demo</span>
              <span>Creada</span>
              <span>Estado</span>
              <span className="text-right">Acciones</span>
            </div>
            <ul className="divide-y divide-white/10">
              {demos.map((d) => (
                <li key={d.id} className="hover:bg-white/[.02]">
                  <div className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[minmax(0,2fr)_120px_110px_minmax(0,2.4fr)] md:items-center md:gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{d.name}</div>
                      <div className="truncate text-[11px] text-muted">/{d.slug}</div>
                    </div>
                    <div className="text-xs text-ink-2">{d.created_at ? new Date(d.created_at).toLocaleDateString("es-AR") : "—"}</div>
                    <div>
                      {d.demo_suspended
                        ? <span className="rounded-full bg-[rgba(240,82,82,.14)] px-2 py-0.5 text-[10px] font-semibold text-crit">Suspendida</span>
                        : <span className="rounded-full bg-[rgba(34,197,94,.14)] px-2 py-0.5 text-[10px] font-semibold text-good">Activa</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold md:justify-end">
                      <button onClick={() => toggleAcc(d)} className="text-brand hover:underline">{openId === d.id ? "Ocultar" : "Accesos"}</button>
                      <a href={`/${d.slug}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">Ver web</a>
                      <button onClick={() => startEdit(d)} className="text-ink-2 hover:text-ink">{editId === d.id ? "Cerrar" : "Editar"}</button>
                      <button onClick={() => regenerar(d)} disabled={busyId === d.id} className="text-ink-2 hover:text-ink disabled:opacity-50">{busyId === d.id ? "…" : "Regenerar IA"}</button>
                      <button onClick={() => suspender(d, !d.demo_suspended)} disabled={busyId === d.id} className="text-warn hover:underline disabled:opacity-50">{d.demo_suspended ? "Reactivar" : "Suspender"}</button>
                      <button onClick={() => startConvert(d)} disabled={busyId === d.id} className="text-good hover:underline disabled:opacity-50">{convId === d.id ? "Cerrar" : "Convertir"}</button>
                      <button onClick={() => eliminar(d)} className="text-crit hover:underline">Eliminar</button>
                    </div>
                  </div>

                  {convId === d.id && (
                      <div className="space-y-2 border-t border-good/20 bg-[rgba(34,197,94,.04)] p-3">
                        <p className="text-xs font-semibold text-good">Convertir en cliente real</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-xs text-ink-2">Plan:</label>
                          <select className="sel w-32 text-xs" value={cPlan} onChange={(e) => setCPlan(e.target.value)}>
                            <option value="basico">Básico</option>
                            <option value="pro">Pro</option>
                            <option value="elite">Elite</option>
                          </select>
                          <label className="text-xs text-ink-2">Estado:</label>
                          <select className="sel w-40 text-xs" value={cStatus} onChange={(e) => setCStatus(e.target.value)}>
                            <option value="trial">Trial 7 días</option>
                            <option value="active">Activo (1 mes)</option>
                          </select>
                          <button className="btn btn-primary ml-auto text-xs" onClick={() => convertir(d)} disabled={busyId === d.id}>
                            {busyId === d.id ? "Convirtiendo…" : "Convertir"}
                          </button>
                        </div>
                        <p className="text-[11px] text-muted">Deja de ser demo y aparece en el Dashboard. Los datos de ejemplo se limpian según el ajuste de <b>Cobros</b>.</p>
                      </div>
                    )}

                    {editId === d.id && (
                      <div className="space-y-2 border-t border-white/10 bg-white/[.02] p-3">
                        <input className="input" value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Nombre" />
                        <input className="input" value={eTag} onChange={(e) => setETag(e.target.value)} placeholder="Frase principal (vacío = no cambiar)" />
                        <textarea className="input" rows={2} value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Descripción (vacío = no cambiar)" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-2">Color:</span>
                          <input type="color" value={eColor} onChange={(e) => setEColor(e.target.value)} className="h-8 w-12 rounded" />
                          <button className="btn btn-primary ml-auto text-xs" onClick={() => guardarEdit(d)} disabled={busyId === d.id}>{busyId === d.id ? "Guardando…" : "Guardar"}</button>
                        </div>
                        <p className="text-[11px] text-muted">Para editar todo (secciones, fotos, planes) entrá con el login del dueño (botón Accesos) → Configurar página.</p>
                      </div>
                    )}

                    {openId === d.id && (
                      <div className="border-t border-white/10 bg-white/[.02] p-3">
                        {accBusy === d.id && !acc[d.id] ? (
                          <p className="text-xs text-muted">Cargando accesos…</p>
                        ) : acc[d.id] ? (
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-ink-2">🌐 Web pública</div>
                                <a href={`/${acc[d.id].slug}`} target="_blank" rel="noreferrer" className="block truncate text-brand hover:underline">{origin()}/{acc[d.id].slug}</a>
                              </div>
                              <CopyBtn text={`${origin()}/${acc[d.id].slug}`} label="Link" />
                            </div>

                            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                              <div className="mb-1 font-semibold text-ink-2">🖥️ Panel del dueño</div>
                              <div className="flex items-center justify-between gap-2">
                                <a href={acc[d.id].owner.url} target="_blank" rel="noreferrer" className="truncate text-brand hover:underline">{origin()}{acc[d.id].owner.url}</a>
                                <CopyBtn text={`${origin()}${acc[d.id].owner.url}`} label="Link" />
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span>Usuario y clave: <b className="text-ink">{acc[d.id].owner.user}</b></span>
                                <CopyBtn text={acc[d.id].owner.user} />
                              </div>
                            </div>

                            {acc[d.id].socio && (
                              <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                                <div className="mb-1 font-semibold text-ink-2">📲 App del socio ({acc[d.id].socio!.name})</div>
                                <div className="flex items-center justify-between gap-2">
                                  <a href={acc[d.id].socio!.url} target="_blank" rel="noreferrer" className="truncate text-brand hover:underline">{origin()}{acc[d.id].socio!.url}</a>
                                  <CopyBtn text={`${origin()}${acc[d.id].socio!.url}`} label="Link" />
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <span>Usuario y clave: <b className="text-ink">{acc[d.id].socio!.user}</b></span>
                                  <CopyBtn text={acc[d.id].socio!.user} />
                                </div>
                              </div>
                            )}

                            <CopyBtn full text={messageFor(acc[d.id])} label="📋 Copiar mensaje para el cliente" />
                          </div>
                        ) : (
                          <p className="text-xs text-crit">No se pudieron cargar los accesos.</p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
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
