/**
 * Lo que comparten el middleware y la pantalla de acceso sobre las apps de
 * tienda.
 *
 * Vive en su propio archivo a propósito: si la página importara esto desde
 * `middleware.ts`, se traería con él todo el cliente de Supabase que el
 * middleware usa, dentro del bundle de la página.
 */

/** Dónde se recuerda de qué gimnasio es la app instalada. */
export const COOKIE_APP = "tg_app";

/** Un año: la app se instala una vez y queda. */
export const COOKIE_APP_DURACION = 60 * 60 * 24 * 365;

/**
 * Un slug de verdad.
 *
 * Frena que llegue basura por la URL antes de que toque la base o se guarde en
 * una cookie.
 */
export const slugValido = (s: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(s);
