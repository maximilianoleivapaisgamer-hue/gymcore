import type { Metadata } from "next";
import PaginaLegal from "@/components/PaginaLegal";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Política de privacidad · ${LEGAL.marca}`,
  description:
    "Qué datos guarda TurnoGym, para qué los usa, con quién los comparte y cómo pedir que se borren.",
};

/**
 * Política de privacidad. PÚBLICA y sin login: es la URL que se carga en la
 * ficha de Google Play y de la App Store, y el revisor la abre antes de
 * aprobar la app.
 *
 * El texto describe lo que la app REALMENTE guarda, leído del esquema de la
 * base. Si agregás una tabla con datos de personas, actualizá esta página.
 */
export default function PrivacidadPage() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      bajada="Qué datos guardamos, para qué, con quién los compartimos y cómo pedir que los borremos."
    >
      <h2>Quién es responsable de qué</h2>
      <p>
        {LEGAL.marca} es el sistema que usan gimnasios, estudios de pilates, escuelas de danza y
        entrenadores para administrar su negocio. Hay dos roles distintos y conviene tenerlos claros:
      </p>
      <ul>
        <li>
          <b>El negocio que te atiende</b> (tu gimnasio o tu profe) es el <b>responsable</b> de tus
          datos como socio. Él decide qué carga, para qué, y a quién se lo muestra.
        </li>
        <li>
          <b>{LEGAL.marca}</b> es el <b>proveedor</b>: ponemos el sistema donde esos datos se
          guardan. Los tratamos siguiendo las instrucciones del negocio y no los usamos para otra
          cosa.
        </li>
      </ul>
      <p>
        Si sos socio y querés que te borren o corrijan algo, lo más rápido es pedírselo al negocio.
        También podés escribirnos a nosotros y lo gestionamos.
      </p>

      <h2>Qué datos guardamos</h2>

      <h3>Del dueño del negocio</h3>
      <ul>
        <li>Nombre, usuario y contraseña (la contraseña va cifrada; nadie la puede ver).</li>
        <li>
          Datos del negocio: nombre, dirección, teléfono, logo, fotos, horarios y precios que él
          mismo carga.
        </li>
        <li>Su plan con nosotros, cuándo le vence y cómo lo paga.</li>
      </ul>

      <h3>De los socios</h3>
      <ul>
        <li>Nombre y apellido, DNI, número de socio.</li>
        <li>Email y WhatsApp, si el negocio los carga.</li>
        <li>Plan contratado, precio y fecha de vencimiento de la cuota.</li>
        <li>Los pagos que el negocio registra.</li>
      </ul>

      <h3>Datos de salud</h3>
      <p>
        Si el negocio usa esas funciones, se guardan tu <b>altura</b>, tus <b>registros de peso</b> y
        las <b>rutinas y planes de comida</b> que te asignan. La ley argentina los considera{" "}
        <b>datos sensibles</b>: solo los ve el negocio que te atiende y vos desde tu app. No se
        comparten con nadie más ni se usan con fines comerciales.
      </p>

      <h3>De uso</h3>
      <ul>
        <li>Las clases que reservás y cancelás, con la fecha.</li>
        <li>Tus entradas al local, si el negocio usa el control de acceso por QR o DNI.</li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Para que el negocio administre socios, cobros, clases, rutinas y planes de comida.</li>
        <li>Para que vos veas tu información y reserves desde tu app.</li>
        <li>
          Para mandarte recordatorios de cuota por WhatsApp, <b>solo si el negocio activó esa
          función</b> y podés pedir que no te lleguen más.
        </li>
        <li>Para que el sistema funcione: entrar a tu cuenta, corregir errores, dar soporte.</li>
      </ul>
      <p>
        <b>No vendemos tus datos, no hacemos publicidad con ellos y no los compartimos entre
        negocios.</b> Cada gimnasio ve únicamente lo suyo.
      </p>

      <h2>Con quién los compartimos</h2>
      <p>Solo con los servicios que hacen falta para que el sistema funcione:</p>
      <ul>
        <li>
          <b>Supabase</b> — guarda la base de datos y las cuentas de acceso.
        </li>
        <li>
          <b>Vercel</b> — sirve la aplicación.
        </li>
        <li>
          <b>Mercado Pago</b> — solo cuando se paga en línea. Nosotros{" "}
          <b>nunca vemos ni guardamos el número de tu tarjeta</b>.
        </li>
        <li>
          <b>Meta (WhatsApp)</b> — solo si el negocio activó los recordatorios automáticos, y
          únicamente para enviarte ese mensaje.
        </li>
        <li>
          <b>Anthropic</b> — solo si el negocio usa la inteligencia artificial para armar tu rutina o
          tu plan de comida. Se le envían los datos necesarios para eso (objetivo, nivel,
          preferencias) y no se usan para entrenar modelos.
        </li>
      </ul>
      <p>
        Varios de estos servicios tienen sus servidores fuera de {LEGAL.pais}. Al usar el sistema,
        aceptás esa transferencia. También podemos entregar datos si nos lo exige una autoridad
        competente.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>
        Mientras el negocio siga siendo cliente y tu ficha siga activa. Si el negocio da de baja su
        cuenta, sus datos y los de sus socios se eliminan. Los movimientos de dinero pueden
        conservarse el tiempo que exija la ley impositiva.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Por la <b>Ley 25.326 de Protección de los Datos Personales</b> podés pedir acceder a tus
        datos, corregirlos, actualizarlos o eliminarlos, en cualquier momento y sin costo.
        Escribinos a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> y te respondemos.
      </p>
      <p>
        La <b>Agencia de Acceso a la Información Pública</b> es el organismo de control y atiende los
        reclamos de quien considere que sus derechos fueron afectados.
      </p>

      <h2>Cómo borrar tu cuenta</h2>
      <p>
        Podés eliminar tu cuenta <b>desde la propia aplicación</b>, en <b>Mi cuenta → Eliminar mi
        cuenta</b>. Se borran tu acceso y tus datos personales de forma definitiva y no se pueden
        recuperar.
      </p>
      <p>
        Si preferís, escribinos a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> desde el mail
        de tu cuenta y lo hacemos nosotros.
      </p>

      <h2>Menores de edad</h2>
      <p>
        Si el socio es menor de 18 años, el negocio tiene que contar con la autorización de la madre,
        el padre o quien esté a cargo antes de cargar sus datos. Si detectamos datos de un menor
        cargados sin autorización, los eliminamos.
      </p>

      <h2>Seguridad</h2>
      <p>
        Las contraseñas se guardan cifradas, la conexión viaja siempre encriptada y cada negocio está
        aislado de los demás a nivel de base de datos. Ningún sistema es infalible: si llegara a
        ocurrir un incidente que afecte tus datos, te lo avisamos.
      </p>

      <h2>Cambios</h2>
      <p>
        Si cambiamos esta política, actualizamos la fecha de arriba y avisamos dentro de la
        aplicación cuando el cambio sea importante.
      </p>
    </PaginaLegal>
  );
}
