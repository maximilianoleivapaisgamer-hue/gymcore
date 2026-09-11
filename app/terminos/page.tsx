import type { Metadata } from "next";
import PaginaLegal from "@/components/PaginaLegal";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Términos y condiciones · ${LEGAL.marca}`,
  description:
    "Las reglas de uso de TurnoGym: qué ofrecemos, qué esperamos de vos y de qué se hace cargo cada uno.",
};

/**
 * Términos del servicio. También PÚBLICA: las tiendas la piden junto con la
 * política de privacidad.
 *
 * Distingue los dos públicos, que tienen relaciones distintas: el DUEÑO
 * contrata con nosotros, y el SOCIO contrata con su gimnasio (nosotros solo
 * ponemos el sistema).
 */
export default function TerminosPage() {
  return (
    <PaginaLegal
      titulo="Términos y condiciones"
      bajada="Las reglas de uso del servicio: qué ofrecemos, qué esperamos de vos y de qué se hace cargo cada uno."
    >
      <h2>Qué es {LEGAL.marca}</h2>
      <p>
        Un sistema en línea para que gimnasios, estudios de pilates, escuelas de danza y entrenadores
        administren socios, cobros, clases, rutinas y planes de comida, y para que sus socios vean su
        información y reserven desde el celular.
      </p>
      <p>
        Al crear una cuenta o usar la aplicación, aceptás estos términos. Si no estás de acuerdo, no
        uses el servicio.
      </p>

      <h2>Hay dos relaciones distintas</h2>
      <ul>
        <li>
          <b>Si sos dueño de un negocio</b>, contratás el servicio con nosotros y pagás un abono
          mensual.
        </li>
        <li>
          <b>Si sos socio</b>, tu relación es <b>con el gimnasio</b>, no con nosotros. Lo que pagás,
          qué incluye tu plan, los horarios y las reservas los define el negocio.{" "}
          {LEGAL.marca} solo pone el sistema donde eso se administra.
        </li>
      </ul>

      <h2>Tu cuenta</h2>
      <ul>
        <li>Sos responsable de tu usuario y tu contraseña, y de lo que se haga con ellos.</li>
        <li>Si te crearon la cuenta con una contraseña provisoria, cambiala la primera vez.</li>
        <li>Los datos que cargues tienen que ser verdaderos y estar actualizados.</li>
        <li>
          Si cargás datos de otras personas (tus socios, tu equipo), te hacés responsable de tener su
          consentimiento.
        </li>
      </ul>

      <h2>El abono, si sos dueño</h2>
      <ul>
        <li>El plan es <b>mensual</b> y los precios están en pesos argentinos.</li>
        <li>
          Podés pagar con Mercado Pago (dinero en cuenta, tarjeta de débito o de crédito) o por
          transferencia, subiendo el comprobante.
        </li>
        <li>
          Si contratás el <b>débito automático</b>, se renueva solo hasta que lo des de baja.
        </li>
        <li>
          Podés dar de baja cuando quieras y el servicio sigue disponible hasta el fin del período ya
          pagado. <b>No hacemos devoluciones por meses empezados.</b>
        </li>
        <li>
          Si el abono queda impago, podemos suspender el acceso. Te avisamos antes; tus datos no se
          borran por una deuda.
        </li>
        <li>
          Podemos cambiar los precios avisando con anticipación. El cambio nunca se aplica a un mes
          que ya pagaste.
        </li>
      </ul>

      <h2>Rutinas, planes de comida e inteligencia artificial</h2>
      <p>
        <b>Nada de lo que muestra la aplicación es una indicación médica.</b> Las rutinas y los planes
        de comida son una guía general, los arma el profesional de tu gimnasio o se generan con
        inteligencia artificial, y pueden contener errores.
      </p>
      <p>
        Antes de empezar cualquier actividad física o cambiar tu alimentación, consultá con un médico
        o con un profesional de la nutrición. Si sentís un malestar, pará y buscá atención. No nos
        hacemos responsables por lesiones ni por consecuencias en tu salud.
      </p>

      <h2>Qué no se puede hacer</h2>
      <ul>
        <li>Entrar a cuentas que no son tuyas ni intentar ver datos de otro negocio.</li>
        <li>Usar el sistema para algo ilegal, o para molestar o perjudicar a otras personas.</li>
        <li>Copiar, revender o imitar el servicio.</li>
        <li>Intentar tirarlo abajo, sobrecargarlo o vulnerar su seguridad.</li>
      </ul>
      <p>Si pasa algo de esto, podemos suspender la cuenta sin aviso previo.</p>

      <h2>Disponibilidad</h2>
      <p>
        Hacemos lo posible para que el servicio esté siempre disponible, pero no podemos garantizar
        que nunca se corte: puede haber mantenimiento, fallas de internet o problemas de los
        proveedores que usamos. Cuando sea planificado, avisamos.
      </p>

      <h2>Tus datos</h2>
      <p>
        Los datos que cargás son tuyos. Nosotros los guardamos y los procesamos según la{" "}
        <a href="/privacidad">política de privacidad</a>. Podés eliminar tu cuenta desde la
        aplicación en cualquier momento.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        Respondemos por lo que dependa de nosotros y hasta el monto que hayas abonado en los últimos
        tres meses. No respondemos por lo que haga el negocio con su información, por decisiones
        tomadas a partir de datos cargados con errores, ni por fallas de los servicios de terceros.
      </p>

      <h2>Cambios y ley aplicable</h2>
      <p>
        Podemos actualizar estos términos; la fecha de arriba dice cuándo fue la última vez y
        avisamos dentro de la aplicación cuando el cambio sea importante.
      </p>
      <p>
        Se aplican las leyes de la República {LEGAL.pais === "Argentina" ? "Argentina" : LEGAL.pais} y
        cualquier conflicto se resuelve ante sus tribunales ordinarios.
      </p>
    </PaginaLegal>
  );
}
