/**
 * Fotos de ejemplo (stock) para rellenar la galería de una demo cuando no hay
 * fotos reales. Usa LoremFlickr (fotos reales de Flickr por etiqueta, sin API
 * key). Cada "lock" devuelve una imagen distinta pero estable.
 *
 * Las fotos reales salen del botón "Traer de Google Maps". Estas son el
 * respaldo para cuando el local NO está en Google (pasa seguido con los que
 * recién abren) o cuando no se eligió ninguna.
 *
 * ⚠️ Importante que peguen con el rubro: una demo de pilates con fotos de sala
 * de pesas no la vendés. Por eso se eligen según el nombre y la descripción.
 */

/** Respaldo genérico de gimnasio (el de siempre). */
export const STOCK_GYM: string[] = [
  "https://loremflickr.com/1200/800/gym,fitness?lock=11",
  "https://loremflickr.com/1200/800/gym,weights?lock=22",
  "https://loremflickr.com/1200/800/fitness,training?lock=33",
  "https://loremflickr.com/1200/800/gym,crossfit?lock=44",
  "https://loremflickr.com/1200/800/gym,workout?lock=55",
  "https://loremflickr.com/1200/800/fitness,dumbbell?lock=66",
];

/** Rubros que reconocemos, con las palabras que los delatan y sus etiquetas. */
const RUBROS: { claves: string[]; tags: string[] }[] = [
  { claves: ["pilates", "reformer"],                      tags: ["pilates", "pilates,studio", "stretching", "yoga,studio", "pilates,exercise", "wellness"] },
  { claves: ["yoga", "meditacion", "meditación"],         tags: ["yoga", "yoga,studio", "meditation", "yoga,class", "wellness", "stretching"] },
  { claves: ["danza", "baile", "zumba", "ballet", "dance"], tags: ["dance", "dance,studio", "dancing", "ballet", "zumba", "dance,class"] },
  { claves: ["crossfit", "funcional", "hiit"],            tags: ["crossfit", "functional,training", "kettlebell", "crossfit,box", "gym,workout", "fitness,training"] },
  { claves: ["box", "boxeo", "kickboxing", "muay"],       tags: ["boxing", "boxing,gym", "punching,bag", "boxing,training", "kickboxing", "gym,fitness"] },
  { claves: ["natacion", "natación", "pileta", "swim"],   tags: ["swimming,pool", "swimming", "pool", "swimmer", "aquatic", "pool,lane"] },
  { claves: ["spinning", "ciclismo", "bike", "indoor cycling"], tags: ["spinning,class", "indoor,cycling", "exercise,bike", "cycling", "gym,bike", "fitness,training"] },
  { claves: ["artes marciales", "karate", "judo", "taekwondo", "jiu"], tags: ["martial,arts", "karate", "judo", "dojo", "training", "gym,fitness"] },
];

/** Fotos para un entrenador personal (1 a 1, no sala llena). */
const STOCK_PERSONAL: string[] = [
  "https://loremflickr.com/1200/800/personal,trainer?lock=11",
  "https://loremflickr.com/1200/800/training,coach?lock=22",
  "https://loremflickr.com/1200/800/fitness,training?lock=33",
  "https://loremflickr.com/1200/800/workout,coach?lock=44",
  "https://loremflickr.com/1200/800/stretching?lock=55",
  "https://loremflickr.com/1200/800/gym,fitness?lock=66",
];

const LOCKS = [11, 22, 33, 44, 55, 66];

/**
 * Elige las fotos de ejemplo que mejor peguen con el negocio.
 *
 * Mira el nombre y lo que se escribió en la descripción; si no reconoce el
 * rubro, cae al respaldo genérico (gimnasio o entrenador según el tipo).
 */
export function stockPara(opts: { nombre?: string; infoLibre?: string; tipo?: string }): string[] {
  const texto = `${opts.nombre || ""} ${opts.infoLibre || ""}`.toLowerCase();
  const rubro = RUBROS.find((r) => r.claves.some((k) => texto.includes(k)));
  if (rubro) {
    return rubro.tags.map((t, i) => `https://loremflickr.com/1200/800/${t}?lock=${LOCKS[i] ?? 11}`);
  }
  return String(opts.tipo || "").toLowerCase() === "personal" ? STOCK_PERSONAL : STOCK_GYM;
}
