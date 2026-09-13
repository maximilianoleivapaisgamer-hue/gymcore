import { cookies } from "next/headers";
import { marcaPorSlug } from "@/lib/gimnasio-publico";
import { COOKIE_APP } from "@/lib/app-nativa";
import FormularioAcceso from "./FormularioAcceso";

/**
 * Login. Tras autenticar, redirige según el rol del usuario.
 *
 * La marca se resuelve ACÁ, en el servidor, para que la pantalla salga ya
 * pintada con los colores del gimnasio en el primer dibujo. Si esto se hiciera
 * en el navegador, el socio vería un parpadeo genérico de turnogym antes de ver
 * su estudio — y esa media pantalla es justo lo que hace que la app no se
 * sienta propia.
 *
 * De dónde sale el gimnasio, en orden:
 *   1. `?app=<slug>` en la URL, que es lo que mandan las apps de tienda.
 *   2. La cookie que dejó el middleware la primera vez que pasó por ahí, para
 *      que siga andando cuando el socio cierra sesión y vuelve a entrar.
 *   3. Nada: la pantalla de siempre, que es la que ve el dueño desde la web.
 */
export default async function AccesoPage({
  searchParams,
}: {
  searchParams?: { app?: string };
}) {
  const slug = searchParams?.app || cookies().get(COOKIE_APP)?.value || null;
  const marca = await marcaPorSlug(slug);
  return <FormularioAcceso marca={marca} />;
}
