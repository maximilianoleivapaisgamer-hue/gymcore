/**
 * Búsqueda de un lugar con la API de Google Maps (Places API v1), como
 * alternativa a Apify para prellenar el generador de demos. Devuelve la misma
 * forma que scrapeGooglePlace (lib/apify) para que el resto no cambie.
 *
 * Requiere una API key de Google Cloud con "Places API (New)" habilitada.
 */

export interface PlaceResult {
  name: string;
  ciudad: string;
  website: string;
  address: string;
  phone: string;
  horarios: { dia: string; horas: string }[];
  images: string[];
}

type GComponent = { longText?: string; shortText?: string; types?: string[] };
type GPhoto = { name?: string };
type GPlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: GPhoto[];
  addressComponents?: GComponent[];
};

function ciudadDe(components: GComponent[] | undefined): string {
  if (!Array.isArray(components)) return "";
  const find = (t: string) => components.find((c) => (c.types || []).includes(t));
  const loc = find("locality") || find("administrative_area_level_2") || find("sublocality");
  const prov = find("administrative_area_level_1");
  const partes = [loc?.longText, prov?.longText].filter(Boolean) as string[];
  return partes.join(", ");
}

/** Convierte una URL de foto (photo.name) en una URL pública usable. */
async function photoUrl(photoName: string, apiKey: string): Promise<string | null> {
  try {
    const u = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(u);
    if (!r.ok) return null;
    const j = (await r.json()) as { photoUri?: string };
    return j.photoUri || null;
  } catch {
    return null;
  }
}

export async function searchGooglePlace(input: string, apiKey: string): Promise<PlaceResult | null> {
  const query = String(input || "").trim();
  if (!query) return null;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.regularOpeningHours,places.photos,places.addressComponents",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "es", regionCode: "AR", maxResultCount: 1 }),
  });

  if (!res.ok) {
    let msg = `Google respondió ${res.status}.`;
    try {
      const e = (await res.json()) as { error?: { message?: string } };
      if (e?.error?.message) msg = e.error.message;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = (await res.json()) as { places?: GPlace[] };
  const p = data.places?.[0];
  if (!p) return null;

  const horarios: { dia: string; horas: string }[] = (p.regularOpeningHours?.weekdayDescriptions || []).map((line) => {
    const i = line.indexOf(":");
    if (i === -1) return { dia: line.trim(), horas: "" };
    return { dia: line.slice(0, i).trim(), horas: line.slice(i + 1).trim() };
  });

  // Traer hasta 8 fotos (cada una es un pedido aparte).
  const photos = (p.photos || []).slice(0, 8).map((ph) => ph.name).filter(Boolean) as string[];
  const images: string[] = [];
  for (const name of photos) {
    const u = await photoUrl(name, apiKey);
    if (u) images.push(u);
  }

  return {
    name: p.displayName?.text || "",
    ciudad: ciudadDe(p.addressComponents),
    website: p.websiteUri || "",
    address: p.formattedAddress || "",
    phone: p.nationalPhoneNumber || p.internationalPhoneNumber || "",
    horarios,
    images,
  };
}

/** Uso/crédito de Apify (para mostrar el saldo). Devuelve montos en USD. */
export async function apifyUsage(token: string): Promise<{ usedUsd: number | null; limitUsd: number | null } | null> {
  try {
    const r = await fetch(`https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(token)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as {
      data?: { current?: { monthlyUsageUsd?: number }; limits?: { maxMonthlyUsageUsd?: number } };
    };
    const usedUsd = j.data?.current?.monthlyUsageUsd ?? null;
    const limitUsd = j.data?.limits?.maxMonthlyUsageUsd ?? null;
    return { usedUsd, limitUsd };
  } catch {
    return null;
  }
}
