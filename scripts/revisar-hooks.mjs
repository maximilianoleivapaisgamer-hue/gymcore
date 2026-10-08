/**
 * Busca hooks declarados DESPUES de un `return` anticipado.
 *
 * Por que existe: el 8/10/26 la ficha del socio quedo tirando "Application
 * error: a client-side exception has occurred" en produccion. La causa eran
 * dos useMemo puestos debajo del `if (loading) return ...`: el primer render
 * corre con menos hooks que el segundo y React tira la pagina entera.
 *
 * No lo agarro nada: `tsc` no mira esto, y next.config tiene
 * eslint.ignoreDuringBuilds con el proyecto sin configuracion de eslint, asi
 * que react-hooks/rules-of-hooks nunca corre. Esto lo reemplaza para el unico
 * caso que ya nos rompio produccion.
 *
 *   node scripts/revisar-hooks.mjs
 *
 * Sale con codigo 1 si encuentra algo, para poder encadenarlo antes de un push.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAICES = ["app", "components"];
const HOOK = /\buse[A-Z]\w*\s*\(/;
/** Un `return` al ras del cuerpo del componente (dos espacios de sangria). */
const RETURN_ARRIBA = /^ {2}(if\s*\(.*\)\s*)?return\b/;
/** Donde arranca un componente: funcion con nombre en Mayuscula, sin sangria. */
const COMPONENTE = /^(export\s+default\s+)?function\s+([A-Z]\w*)\s*\(/;

function archivos(dir) {
  const salida = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) salida.push(...archivos(p));
    else if (p.endsWith(".tsx")) salida.push(p);
  }
  return salida;
}

/** Saca comentarios de linea para no marcar un hook nombrado en un comentario. */
const limpia = (l) => l.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");

let fallas = 0;
for (const raiz of RAICES) {
  for (const archivo of archivos(raiz)) {
    const lineas = readFileSync(archivo, "utf8").split("\n");
    let dentro = null;          // nombre del componente en curso
    let desdeReturn = 0;        // linea del primer return al ras

    lineas.forEach((cruda, i) => {
      const l = limpia(cruda);
      const abre = l.match(COMPONENTE);
      if (abre) { dentro = abre[2]; desdeReturn = 0; return; }
      if (dentro && l === "}") { dentro = null; return; }
      if (!dentro) return;

      if (!desdeReturn && RETURN_ARRIBA.test(l)) { desdeReturn = i + 1; return; }
      // Un hook despues del primer return al ras: ese es el error.
      if (desdeReturn && /^ {2}(const|let)\s/.test(l) && HOOK.test(l)) {
        fallas++;
        console.log(
          `${archivo}:${i + 1}  hook despues del return de la linea ${desdeReturn}` +
          ` (componente ${dentro})\n    ${cruda.trim()}`,
        );
      }
    });
  }
}

console.log(fallas === 0
  ? "Hooks: ningun hook quedo debajo de un return anticipado."
  : `\n${fallas} hook(s) mal ubicados. Eso rompe la pantalla en el navegador.`);
process.exit(fallas ? 1 : 0);
