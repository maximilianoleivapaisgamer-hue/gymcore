/**
 * La marca del negocio en el teléfono del socio.
 *
 * Lo usan tres lugares que TIENEN que coincidir: el manifest
 * (`/manifest/<slug>`), el título que muestra iOS al agregar a la pantalla de
 * inicio, y la vista previa de "Mi cuenta". Si difieren, la previa le miente al
 * dueño sobre cómo va a quedar.
 */

/** Saca los espacios de más: hay nombres cargados como "DanzArte  Estudio". */
export function nombreLimpio(nombre?: string | null, porDefecto = "turnogym"): string {
  return String(nombre || "").replace(/\s+/g, " ").trim() || porDefecto;
}

/**
 * El nombre que entra abajo del ícono.
 *
 * Android corta cerca de los 12 caracteres, así que elegimos el corte nosotros:
 * si no, queda partido en medio de una palabra. Con "DanzArte  Estudio Fitness"
 * el corte crudo daba "DanzArte  Es"; cortando por palabras da "DanzArte", que
 * es como la conocen.
 */
export function nombreCorto(nombre?: string | null, tope = 12): string {
  const limpio = nombreLimpio(nombre);
  if (limpio.length <= tope) return limpio;

  let corto = "";
  for (const palabra of limpio.split(" ")) {
    const probar = corto ? `${corto} ${palabra}` : palabra;
    if (probar.length > tope) break;
    corto = probar;
  }
  // Si ni la primera palabra entra, no queda otra que cortarla.
  return corto || limpio.slice(0, tope).trim();
}
