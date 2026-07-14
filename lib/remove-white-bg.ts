/**
 * Quita el fondo blanco de una imagen (típico de logos bajados de Instagram).
 * Corre 100% en el navegador con canvas: los píxeles casi-blancos pasan a
 * transparentes, con una banda suave en los bordes para que no queden dientes.
 * Devuelve un PNG (con transparencia). Si algo falla, devuelve el archivo original.
 */
export async function removeWhiteBackground(file: File, threshold = 238): Promise<File> {
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

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0);

    const soft = 210; // debajo de esto se mantiene opaco
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const m = Math.min(r, g, b);
      if (m >= threshold) {
        d[i + 3] = 0; // casi blanco puro → transparente
      } else if (m > soft) {
        // banda suave: transparencia parcial cerca del blanco
        d[i + 3] = Math.round(((threshold - m) / (threshold - soft)) * d[i + 3]);
      }
    }
    ctx.putImageData(id, 0, 0);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "logo";
    return new File([blob], `${base}.png`, { type: "image/png" });
  } catch {
    return file;
  }
}
