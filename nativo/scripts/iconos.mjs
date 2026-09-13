/**
 * Los íconos y la pantalla de arranque de cada app, sacados de UN solo PNG.
 *
 * Existe porque `@capacitor/assets`, que es la herramienta oficial para esto,
 * arrastra una versión vieja de `sharp` que se baja binarios de GitHub y acá no
 * termina nunca de instalarse. Hacerlo a mano son cien líneas, no depende de
 * nada que se pueda caer, y deja explícito qué pide cada tienda.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/** Densidades de Android y su multiplicador sobre el tamaño base. */
const DENSIDADES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** El ícono común mide 48dp; el del ícono adaptable, 108dp. */
const LADO_ICONO = 48;
const LADO_ADAPTABLE = 108;

/** La pantalla de arranque, en vertical. La horizontal es la misma dada vuelta. */
const SPLASH_VERTICAL = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };

/** Un PNG de color liso. */
const liso = (ancho, alto, color) =>
  sharp({ create: { width: ancho, height: alto, channels: 3, background: color } }).png().toBuffer();

/**
 * El ícono, cuadrado y sin transparencia.
 *
 * Aplanar contra el color del gimnasio no es un detalle: **Apple rechaza los
 * íconos con canal alfa**, y es de los rechazos más bobos y más frecuentes.
 */
const cuadrado = (origen, lado, color) =>
  sharp(origen).resize(lado, lado, { fit: "cover" }).flatten({ background: color }).png().toBuffer();

/** El mismo ícono recortado en círculo, que es lo que pide `ic_launcher_round`. */
async function redondo(origen, lado, color) {
  const mascara = Buffer.from(
    `<svg width="${lado}" height="${lado}"><circle cx="${lado / 2}" cy="${lado / 2}" r="${lado / 2}"/></svg>`,
  );
  return sharp(await cuadrado(origen, lado, color))
    .composite([{ input: mascara, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/**
 * La capa de adelante del ícono adaptable de Android.
 *
 * Va con fondo transparente y el dibujo al 60% del lienzo: el teléfono le da la
 * forma que quiera (círculo, cuadrado, gota) y recorta los bordes. Si el dibujo
 * ocupara todo, cada marca de teléfono le comería un pedazo distinto.
 */
async function capaAdelante(origen, lado) {
  const dibujo = await sharp(origen)
    .resize(Math.round(lado * 0.6), Math.round(lado * 0.6), {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp({
    create: { width: lado, height: lado, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: dibujo, gravity: "centre" }])
    .png()
    .toBuffer();
}

/** La pantalla de arranque: el ícono centrado y chico sobre el color del gimnasio. */
async function pantallaArranque(origen, ancho, alto, color) {
  const lado = Math.round(Math.min(ancho, alto) * 0.34);
  const dibujo = await sharp(origen)
    .resize(lado, lado, { fit: "contain", background: color })
    .flatten({ background: color })
    .png()
    .toBuffer();
  return sharp(await liso(ancho, alto, color))
    .composite([{ input: dibujo, gravity: "centre" }])
    .png()
    .toBuffer();
}

const escribir = (carpeta, nombre, datos) => {
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, nombre), datos);
};

/** Todo lo que necesita Android, escrito adentro de `android/app/src/main/res`. */
export async function generarAndroid(origen, color, res) {
  for (const [densidad, factor] of Object.entries(DENSIDADES)) {
    const carpeta = join(res, `mipmap-${densidad}`);
    const lado = Math.round(LADO_ICONO * factor);
    escribir(carpeta, "ic_launcher.png", await cuadrado(origen, lado, color));
    escribir(carpeta, "ic_launcher_round.png", await redondo(origen, lado, color));
    escribir(carpeta, "ic_launcher_foreground.png",
      await capaAdelante(origen, Math.round(LADO_ADAPTABLE * factor)));
  }

  // El fondo del ícono adaptable. El molde de Capacitor lo deja en blanco, que
  // sobre un ícono oscuro queda un marco blanco horrible.
  escribir(join(res, "values"), "ic_launcher_background.xml",
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${color}</color>\n</resources>\n`);

  for (const [densidad, [ancho, alto]] of Object.entries(SPLASH_VERTICAL)) {
    escribir(join(res, `drawable-port-${densidad}`), "splash.png",
      await pantallaArranque(origen, ancho, alto, color));
    escribir(join(res, `drawable-land-${densidad}`), "splash.png",
      await pantallaArranque(origen, alto, ancho, color));
  }
  // La de respaldo, para el teléfono que no entre en ninguna densidad.
  escribir(join(res, "drawable"), "splash.png", await pantallaArranque(origen, 960, 1600, color));

  return Object.keys(DENSIDADES).length * 3 + 11;
}

/**
 * Todo lo que necesita iOS, escrito adentro de `ios/App/App/Assets.xcassets`.
 *
 * Se genera SIEMPRE, aunque estemos en Windows y no exista la carpeta `ios/`:
 * queda en `assets/ios/` para que la Mac (o el runner de la nube) la copie sin
 * tener que volver a generar nada.
 */
export async function generarIOS(origen, color, xcassets) {
  const icono = join(xcassets, "AppIcon.appiconset");
  // Xcode moderno se conforma con el de 1024: de ahí saca todos los demás.
  escribir(icono, "AppIcon-512@2x.png", await cuadrado(origen, 1024, color));
  escribir(icono, "Contents.json", JSON.stringify({
    images: [{ filename: "AppIcon-512@2x.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
    info: { author: "xcode", version: 1 },
  }, null, 2) + "\n");

  const splash = join(xcassets, "Splash.imageset");
  const fondo = await pantallaArranque(origen, 2732, 2732, color);
  for (const n of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    escribir(splash, n, fondo);
  }
  escribir(splash, "Contents.json", JSON.stringify({
    images: [
      { filename: "splash-2732x2732-2.png", idiom: "universal", scale: "1x" },
      { filename: "splash-2732x2732-1.png", idiom: "universal", scale: "2x" },
      { filename: "splash-2732x2732.png", idiom: "universal", scale: "3x" },
    ],
    info: { author: "xcode", version: 1 },
  }, null, 2) + "\n");

  return 6;
}
