/**
 * Cliente mínimo de Apify (para leer el perfil de Google Maps de un gimnasio).
 *
 * Usa la API de Apify con "run-sync-get-dataset-items": corre un actor y
 * devuelve los resultados en una sola llamada. Requiere APIFY_TOKEN en el
 * servidor. El actor de Google Maps se puede cambiar con APIFY_GMAPS_ACTOR
 * (por defecto el popular "compass/crawler-google-places").
 *
 * Solo se importa desde rutas de servidor (app/api/**): el token nunca se
 * expone al cliente.
 */

const DEFAULT_GMAPS_ACTOR = "compass~crawler-google-places";

/** Corre un actor de Apify y devuelve los items del dataset. */
export async function runActorSync(actor: string, input: unknown, token: string): Promise<Record<string, unknown>[]> {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Apify respondió ${res.status}. ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export interface GooglePlace {
  name: string;
  address: string;
  ciudad: string;
  phone: string;
  website: string;
  horarios: { dia: string; horas: string }[];
  images: string[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Normaliza los horarios que devuelve el actor (varias formas posibles). */
function normalizeHours(raw: unknown): { dia: string; horas: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { dia: string; horas: string }[] = [];
  for (const h of raw) {
    if (h && typeof h === "object") {
      const o = h as Record<string, unknown>;
      const dia = str(o.day) || str(o.dia) || str(o.weekday);
      const horas = str(o.hours) || str(o.horas) || str(o.time) || (Array.isArray(o.hours) ? (o.hours as string[]).join(", ") : "");
      if (dia) out.push({ dia, horas: horas || "—" });
    } else if (typeof h === "string" && h.trim()) {
      out.push({ dia: h, horas: "" });
    }
  }
  return out;
}

function toImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === "string" ? x : (x && typeof x === "object" ? str((x as Record<string, unknown>).imageUrl || (x as Record<string, unknown>).url) : "")))
    .filter(Boolean)
    .slice(0, 12);
}

/** Sigue redirecciones de un link corto (share.google, maps.app.goo.gl, goo.gl). */
async function resolveRedirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" },
    });
    return res.url || null;
  } catch {
    return null;
  }
}

const isFullMapsUrl = (s: string) =>
  /https?:\/\/(www\.)?google\.[^/]+\/maps/i.test(s) || /\/maps\/(search|place)/i.test(s) || /[?&]cid=\d+/i.test(s);
const isShortLink = (s: string) =>
  /^https?:\/\/(share\.google|maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[^/]+\/url)/i.test(s.trim());

/**
 * Lee un lugar de Google Maps a partir de lo que escriba el usuario: un link de
 * Google Maps (incluidos los cortos share.google / maps.app.goo.gl, que se
 * resuelven), o texto libre "nombre + ciudad" (que se busca). Devuelve datos
 * normalizados o null.
 */
export async function scrapeGooglePlace(
  rawInput: string,
  token: string,
  actor = process.env.APIFY_GMAPS_ACTOR || DEFAULT_GMAPS_ACTOR
): Promise<GooglePlace | null> {
  const s = (rawInput || "").trim();
  if (!s) return null;

  // Decidir: link directo, link corto (resolver), o búsqueda por texto.
  let startUrl: string | null = null;
  let query: string | null = null;
  if (isFullMapsUrl(s)) {
    startUrl = s;
  } else if (isShortLink(s)) {
    const resolved = await resolveRedirect(s);
    if (resolved && isFullMapsUrl(resolved)) startUrl = resolved;
    else startUrl = s; // último recurso
  } else {
    query = s; // texto libre → búsqueda
  }

  const input: Record<string, unknown> = {
    maxImages: 12,
    language: "es",
    maxCrawledPlacesPerSearch: 1,
    maxCrawledPlaces: 1,
    scrapeImageAuthors: false,
  };
  if (startUrl) input.startUrls = [{ url: startUrl }];
  else if (query) input.searchStringsArray = [query];
  else return null;

  const items = await runActorSync(actor, input, token);
  const it = items[0];
  if (!it) return null;

  const cityParts = [str(it.city), str(it.state)].filter(Boolean);
  return {
    name: str(it.title) || str(it.name),
    address: str(it.address) || str(it.street),
    ciudad: cityParts.join(", "),
    phone: str(it.phone) || str(it.phoneUnformatted),
    website: str(it.website) || str(it.url),
    horarios: normalizeHours(it.openingHours || it.hours || it.openingHoursBusinessConfirmationText),
    images: toImages(it.imageUrls || it.images),
  };
}
