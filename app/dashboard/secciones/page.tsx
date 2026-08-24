import { redirect } from "next/navigation";

/** Secciones se fusionó con Estilo de la app dentro de "Configuración".
 *  Queda esta redirección por si alguien tenía la dirección guardada. */
export default function SeccionesRedirect() {
  redirect("/dashboard/ajustes");
}
