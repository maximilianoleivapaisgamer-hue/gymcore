#!/usr/bin/env node
/**
 * Deja el proyecto nativo listo para compilar LA app de un gimnasio.
 *
 *   npm run preparar -- danzarte
 *   npm run preparar -- danzarte --abrir android
 *
 * Qué hace, en orden:
 *   1. Busca el gimnasio en apps.json y revisa que no le falte nada.
 *   2. Escribe capacitor.config.json con SU id, SU nombre y SU color.
 *   3. Rehace el proyecto de Android desde cero con ese id.
 *   4. Le mete sus íconos y su pantalla de arranque.
 *
 * ⚠️ El proyecto nativo es DESCARTABLE: se borra y se rehace entero en cada
 * corrida. No edites nada a mano adentro de android/ ni de ios/, porque la
 * próxima corrida te lo pisa. Si hace falta un cambio permanente, va acá.
 *
 * Se rehace en vez de retocarse porque el id de la app (`com.turnogym.loquesea`)
 * queda cocido en media docena de archivos cuando se crea el proyecto, y
 * cambiarlo después a mano es justo la clase de cosa que se rompe en silencio y
 * te hace publicar la app de un gimnasio con el id de otro.
 *
 * ⚠️ Una app por gimnasio significa que cada una tiene que VERSE distinta. Dos
 * apps con el mismo ícono y la misma pantalla de inicio son, para Apple, la
 * misma app repetida (regla 4.3) y te rechazan las dos.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generarAndroid, generarIOS } from "./iconos.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");

/**
 * De dónde carga la app.
 *
 * Es el sitio de verdad, no un paquete congelado adentro del .apk: así una
 * corrección sale publicada al toque y no espera los días que tarda la revisión
 * de las tiendas. El precio es que la app necesita señal, y por eso existe la
 * pantalla de respaldo de `www/`.
 */
const SITIO = "https://www.turnogym.com";

function morir(mensaje) {
  console.error(`\n✖ ${mensaje}\n`);
  process.exit(1);
}

// ── Qué app hay que preparar ────────────────────────────────────────────
const args = process.argv.slice(2);
const clave = args.find((a) => !a.startsWith("--"));
const iAbrir = args.indexOf("--abrir");
const abrir = iAbrir >= 0 ? args[iAbrir + 1] : null;

const { apps } = JSON.parse(readFileSync(join(RAIZ, "apps.json"), "utf8"));
if (!clave) {
  morir(
    `Decime qué app preparar. Las que hay:\n` +
    apps.map((a) => `    ${a.clave.padEnd(14)} ${a.nombreCompleto}`).join("\n") +
    `\n\n  Ejemplo:  npm run preparar -- ${apps[0].clave}`,
  );
}
const app = apps.find((a) => a.clave === clave);
if (!app) morir(`No existe la app "${clave}". Las que hay: ${apps.map((a) => a.clave).join(", ")}`);

// ── Chequeos que evitan un rechazo de tienda ────────────────────────────
if (app.nombre.length > 30) {
  morir(`El nombre "${app.nombre}" tiene ${app.nombre.length} caracteres. Apple corta en 30.`);
}
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(app.idApp)) {
  morir(`El id "${app.idApp}" no sirve. Va todo en minúscula y con puntos: com.turnogym.loquesea`);
}
const repetido = apps.filter((a) => a.idApp === app.idApp);
if (repetido.length > 1) morir(`El id "${app.idApp}" está repetido en apps.json. Cada app lleva el suyo.`);

const icono = join(RAIZ, app.icono);
if (!existsSync(icono)) {
  morir(
    `Falta el ícono de ${app.nombreCompleto}.\n` +
    `  Lo esperaba en: ${icono}\n\n` +
    `  Tiene que ser un PNG de 1024x1024, cuadrado.\n` +
    `  Sin esto no hay app: las dos tiendas lo piden, y Apple rechaza dos apps\n` +
    `  que comparten el ícono aunque tengan distinto nombre.`,
  );
}

console.log(`\n▸ ${app.nombreCompleto}   ${app.idApp}\n`);

const correr = (cmd, argumentos) =>
  execFileSync(cmd, argumentos, { cwd: RAIZ, stdio: "inherit", shell: process.platform === "win32" });

// ── 1. La configuración ─────────────────────────────────────────────────
const config = {
  appId: app.idApp,
  appName: app.nombre,
  webDir: "www",
  server: {
    // Abre directo en la pantalla del socio. Si no inició sesión, el sitio lo
    // manda solo a la de acceso.
    url: `${SITIO}/portal?app=${encodeURIComponent(app.slug)}`,
    // Sin esto Android sirve el contenido como http y el navegador embebido
    // descarta las cookies de sesión: el socio no podría ni entrar.
    androidScheme: "https",
    cleartext: false,
  },
  android: { allowMixedContent: false },
  ios: { contentInset: "always", limitsNavigationsToAppBoundDomains: false },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: app.colorFondo,
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: { style: "DARK", backgroundColor: app.colorFondo },
  },
};
writeFileSync(join(RAIZ, "capacitor.config.json"), JSON.stringify(config, null, 2) + "\n");
console.log("  ✓ configuración");

// ── 2. La pantalla de respaldo ──────────────────────────────────────────
// Capacitor exige una carpeta web aunque cargue el sitio de verdad. Es lo que
// se ve si el teléfono arranca sin señal.
mkdirSync(join(RAIZ, "www"), { recursive: true });
writeFileSync(
  join(RAIZ, "www", "index.html"),
  readFileSync(resolve(RAIZ, "..", "public", "sin-conexion.html"), "utf8"),
);
console.log("  ✓ pantalla de respaldo sin señal");

// ── 3. El proyecto de Android, desde cero ───────────────────────────────
rmSync(join(RAIZ, "android"), { recursive: true, force: true });
correr("npx", ["cap", "add", "android"]);

// ── 4. iOS ──────────────────────────────────────────────────────────────
// El proyecto de iOS solo se puede crear en una Mac (necesita CocoaPods y
// Xcode). En Windows se saltea y los íconos quedan generados igual, listos para
// que los levante la Mac o el runner de la nube.
const enMac = process.platform === "darwin";
if (enMac && !existsSync(join(RAIZ, "ios"))) correr("npx", ["cap", "add", "ios"]);
correr("npx", ["cap", "sync"]);

// ── 5. Los íconos ───────────────────────────────────────────────────────
const res = join(RAIZ, "android", "app", "src", "main", "res");
const cuantosAndroid = await generarAndroid(icono, app.colorFondo, res);
console.log(`  ✓ ${cuantosAndroid} archivos de Android (íconos, ícono adaptable, arranque)`);

const destinoIOS = enMac
  ? join(RAIZ, "ios", "App", "App", "Assets.xcassets")
  : join(RAIZ, "assets", "ios", "Assets.xcassets");
await generarIOS(icono, app.colorFondo, destinoIOS);
console.log(`  ✓ íconos de iOS${enMac ? "" : " (en assets/ios/, para la Mac)"}`);

console.log(`\n✓ ${app.nombreCompleto} lista para compilar.`);
if (!enMac) console.log("  · iOS necesita una Mac: se compila en el flujo de la nube.");
console.log("");
if (abrir) correr("npx", ["cap", "open", abrir]);
