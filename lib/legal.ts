/**
 * Datos de contacto y fechas de las páginas legales.
 *
 * Viven acá y no adentro de cada página para que /privacidad y /terminos
 * digan siempre lo mismo, y para cambiarlos en un solo lugar.
 *
 * ⚠️ Las tiendas exigen una URL pública de política de privacidad y un contacto
 * al que se pueda escribir DE VERDAD. Si cambiás el mail, asegurate de que
 * exista y que alguien lo lea: es la dirección que va en la ficha de la app.
 */

export const LEGAL = {
  marca: "TurnoGym",
  sitio: "turnogym.com",
  /** Razón social / responsable. Aparece en las dos páginas. */
  responsable: "Marcela Ojeda",
  pais: "Argentina",
  email: "soporte@turnogym.com",
  /** Sin el 0 ni el 15, como lo guarda platform_settings. */
  whatsapp: "1150573199",
  /** Se muestra como "Última actualización". Actualizala si cambiás el texto. */
  actualizado: "11 de septiembre de 2026",
} as const;

/** El número en formato lindo para mostrar: 11 5057-3199 */
export function whatsappLegible(n: string = LEGAL.whatsapp): string {
  const d = n.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}` : n;
}
