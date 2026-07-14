/**
 * Detecta el color de marca dominante de una imagen (logo o captura del perfil).
 * Corre en el navegador con canvas. Ignora blancos, negros y grises (fondo y
 * texto) y se queda con el color más vívido y frecuente — el de la marca.
 * Devuelve un hex o null.
 */
export async function dominantColor(file: File): Promise<string | null> {
  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ""));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });

    const size = 90;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const d = ctx.getImageData(0, 0, size, size).data;

    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (a < 128) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max > 238 && min > 238) continue;      // casi blanco
      if (max < 30) continue;                    // casi negro
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat < 0.28) continue;                  // gris → lo ignoramos
      // Cuantizamos a bloques para agrupar tonos parecidos, ponderando por saturación.
      const key = `${r >> 5},${g >> 5},${b >> 5}`;
      const bk = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      const w = 1 + sat; // el color más vívido pesa más
      bk.count += w; bk.r += r * w; bk.g += g * w; bk.b += b * w;
      buckets.set(key, bk);
    }

    let best: { count: number; r: number; g: number; b: number } | null = null;
    for (const bk of buckets.values()) if (!best || bk.count > best.count) best = bk;
    if (!best) return null;
    const r = Math.round(best.r / best.count);
    const g = Math.round(best.g / best.count);
    const b = Math.round(best.b / best.count);
    return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
