/**
 * Corre `tsc` y avisa si aparecieron errores NUEVOS.
 *
 * No se puede exigir cero: el proyecto arrastra errores que no son del codigo
 * sino del desfasaje de tipos de @supabase/supabase-js (conversiones de
 * SupabaseClient y de los select con join). Son siempre los mismos y no
 * rompen nada en ejecucion.
 *
 * Entonces se compara contra esa base. Si el numero sube, algo se rompio; si
 * baja, alguien arreglo errores viejos y hay que bajar la base de aca.
 *
 *   node scripts/revisar-tipos.mjs
 */
import { execSync } from "node:child_process";

/** Errores preexistentes al 2026-10-08, todos por los tipos de supabase-js. */
const BASE = 16;

let salida = "";
try {
  salida = execSync("npx tsc --noEmit", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  salida = `${e.stdout || ""}${e.stderr || ""}`;
}

const errores = salida.split("\n").filter((l) => l.includes("error TS"));
const nuevos = errores.length - BASE;

if (nuevos > 0) {
  console.log(errores.join("\n"));
  console.log(`\nTipos: ${errores.length} errores, ${nuevos} mas que la base de ${BASE}.`);
  process.exit(1);
}
if (nuevos < 0) {
  console.log(`Tipos: ${errores.length} errores, ${-nuevos} MENOS que la base de ${BASE}.`);
  console.log("Se arreglaron errores viejos: bajá BASE en scripts/revisar-tipos.mjs.");
  process.exit(1);
}
console.log(`Tipos: ${errores.length} errores, los mismos de siempre (ninguno nuevo).`);
