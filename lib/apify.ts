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

/**
 * Lee un lugar de Google Maps por URL o por texto (nombre + ciudad).
 * Devuelve datos normalizados o null si no encontró nada.
 */
export async function scrapeGooglePlace(
  q: { url?: string; query?: string },
  token: string,
  actor = process.env.APIFY_GMAPS_ACTOR || DEFAULT_GMAPS_ACTOR
): Promise<GooglePlace | null> {
  const input: Record<string, unknown> = {
    maxImages: 12,
    language: "es",
    maxCrawledPlacesPerSearch: 1,
    maxCrawledPlaces: 1,
    scrapeImageAuthors: false,
  };
  if (q.url) input.startUrls = [{ url: q.url }];
  else if (q.query) input.searchStringsArray = [q.query];
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
