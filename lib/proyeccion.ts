/**
 * A dónde puede llegar esta persona, con SUS números.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────
 *
 * La simulación de resultados podría hacerse pidiéndole al modelo de imagen
 * "mostrá a esta persona en forma". Eso devuelve un cuerpo de revista: nadie lo
 * alcanza, el socio se siente estafado a los tres meses y el gimnasio se come
 * el reclamo.
 *
 * Acá se calcula ANTES un objetivo realista con el peso, la altura y el ritmo
 * real de esa persona, y la imagen se pide contra ese número. Eso hace dos
 * cosas a la vez: la imagen es alcanzable de verdad, y hay con qué explicar el
 * número si alguien lo cuestiona.
 *
 * ── Los tres caminos ────────────────────────────────────────────────────
 *
 * No a todo el mundo le corresponde bajar de peso, y tratarlos a todos igual
 * es justamente lo que rompe la credibilidad:
 *
 *   IMC > 25   → bajar grasa. Es el caso típico del que se anota.
 *   IMC 18.5-25 → RECOMPOSICIÓN: el peso casi no se mueve, cambia la forma.
 *                 Prometerle a alguien de peso normal que va a bajar 8 kilos es
 *                 prometerle que va a quedar flaco, no en forma.
 *   IMC < 18.5 → subir, con masa muscular.
 *
 * ── Los topes ───────────────────────────────────────────────────────────
 *
 * El ritmo está acotado por arriba (lo que es sano y sostenible) y el resultado
 * tiene un piso de IMC 21: nunca se proyecta a alguien al límite de bajo peso.
 * Aunque matemáticamente diera, prometer "flaco" no es prometer "en forma".
 */

export type Enfoque = "bajar" | "recomposicion" | "subir";

export interface Proyeccion {
  enfoque: Enfoque;
  pesoActual: number;
  /** El peso al que puede llegar en ese plazo. */
  pesoObjetivo: number;
  /** Cuántos kilos se mueve (negativo si baja). */
  cambio: number;
  imcActual: number;
  imcObjetivo: number;
  /** En criollo, para mostrar debajo de la imagen. */
  explicacion: string;
  /** Lo que se le pide al modelo de imagen. */
  descripcionFisica: string;
  /** El maximo de kilos que el entrenador puede pedir para este plazo. */
  topeKilos: number;
  /** True si el entrenador escribio un numero distinto al sugerido. */
  aMano: boolean;
}

/**
 * Ritmo de bajada SUGERIDO, como porcentaje del peso corporal por mes.
 *
 * Lo aceptado para alguien con sobrepeso es 0,5 a 1% del peso corporal por
 * SEMANA, o sea 2 a 4% mensual. Arrancamos en 2% y quedaba demasiado tibio:
 * a los 3 meses el cambio casi no se notaba en la imagen y la herramienta
 * perdia la gracia. 3% queda en el medio de la banda sana.
 *
 * Es una SUGERENCIA: el entrenador la puede cambiar, acotado por TOPE_MENSUAL.
 */
const RITMO_SUGERIDO_MENSUAL = 0.03;

/**
 * ⚠️ NO hay tope por plazo: decision del dueño del producto. Si el entrenador
 * quiere pedir 15 kilos en 3 meses, los pide. Conoce a la persona y es su
 * negocio el que responde por el numero.
 *
 * Queda UN solo freno, y es de otra naturaleza: no proyectar a nadie por
 * debajo del peso saludable. No limita la ambicion, evita que salga la imagen
 * de una persona enferma — que ademas nadie quiere mostrar ni vender.
 */

/**
 * El piso. 18,5 es el borde medico entre peso normal y bajo peso: es lo mas
 * permisivo que se puede ser sin generar la imagen de alguien desnutrido.
 */
const IMC_PISO = 18.5;
/** Ni por encima, cuando alguien tiene que subir. */
const IMC_TECHO = 24;

/**
 * La bajada se frena con el tiempo: los primeros kilos salen mucho más fácil
 * que los últimos. Una proyección lineal a 6 meses miente el doble que a 3.
 */
const FRENO_POR_MES = 0.88;

const imc = (kg: number, cm: number) => kg / ((cm / 100) ** 2);
const redondear = (n: number) => Math.round(n * 10) / 10;

export interface DatosSocio {
  pesoKg: number;
  alturaCm: number;
  /**
   * Kilos por mes que viene bajando de verdad, si hay historial. Negativo =
   * está bajando. Cuando lo hay, MANDA ESTE por sobre el teórico: es el dato
   * de esta persona y no un promedio de folleto.
   */
  ritmoRealMensual?: number | null;
}

export function proyectar(
  d: DatosSocio,
  meses: number,
  /**
   * Kilos que pide el entrenador, si quiere cambiar la sugerencia. Siempre en
   * positivo (los que baja o sube). Se acota al tope sano: el entrenador
   * conoce a la persona mejor que nosotros, pero el freno no lo maneja el.
   */
  kilosAMano?: number | null,
): Proyeccion | null {
  const { pesoKg, alturaCm } = d;
  // Sin altura no hay IMC y sin IMC no se puede decidir el camino ni poner
  // topes. Antes que inventar, no se genera nada.
  if (!pesoKg || !alturaCm || pesoKg < 30 || pesoKg > 300 || alturaCm < 120 || alturaCm > 230) {
    return null;
  }

  const imcActual = imc(pesoKg, alturaCm);
  const enfoque: Enfoque = imcActual > 25 ? "bajar" : imcActual < 18.5 ? "subir" : "recomposicion";

  let pesoObjetivo = pesoKg;

  if (enfoque === "bajar") {
    // El ritmo teórico sano, frenándose mes a mes.
    let restante = pesoKg;
    for (let m = 0; m < meses; m++) {
      restante -= restante * RITMO_SUGERIDO_MENSUAL * Math.pow(FRENO_POR_MES, m);
    }
    let porTeoria = restante;

    // Si ya viene bajando y lo hace MÁS LENTO que el techo, se le cree a su
    // propio ritmo. Nunca se le promete más rápido de lo que viene logrando.
    if (d.ritmoRealMensual != null && d.ritmoRealMensual < 0) {
      const porRitmoReal = pesoKg + d.ritmoRealMensual * meses;
      porTeoria = Math.max(porTeoria, porRitmoReal);
    }
    pesoObjetivo = porTeoria;

    // El piso: nunca al límite de bajo peso.
    const pesoPiso = IMC_PISO * ((alturaCm / 100) ** 2);
    pesoObjetivo = Math.max(pesoObjetivo, pesoPiso);
  } else if (enfoque === "subir") {
    // Subir es mucho más lento que bajar: 1% mensual y con techo.
    const pesoTecho = IMC_TECHO * ((alturaCm / 100) ** 2);
    pesoObjetivo = Math.min(pesoKg * (1 + 0.01 * meses), pesoTecho);
  }
  // En recomposición el peso queda igual a propósito: lo que cambia es la forma.

  // El maximo que se puede pedir para este plazo, sin pasar el piso de IMC.
  const pesoPisoAbs = IMC_PISO * ((alturaCm / 100) ** 2);
  // Lo unico que acota: no bajar del peso saludable. No hay limite por plazo.
  const topeKilos = enfoque === "bajar"
    ? redondear(Math.max(0, pesoKg - pesoPisoAbs))
    : enfoque === "subir"
      ? redondear(Math.max(0, IMC_TECHO * ((alturaCm / 100) ** 2) - pesoKg))
      : redondear(Math.max(0, pesoKg - pesoPisoAbs));

  // El entrenador manda, pero acotado.
  let aMano = false;
  if (kilosAMano != null && Number.isFinite(kilosAMano) && kilosAMano > 0) {
    const limite = enfoque === "subir" ? topeKilos : Math.max(0, pesoKg - pesoPisoAbs);
    const pedidos = Math.min(Math.abs(kilosAMano), limite);
    pesoObjetivo = enfoque === "subir" ? pesoKg + pedidos : pesoKg - pedidos;
    aMano = true;
  }

  pesoObjetivo = redondear(pesoObjetivo);
  const cambio = redondear(pesoObjetivo - pesoKg);
  const imcObjetivo = imc(pesoObjetivo, alturaCm);

  return {
    enfoque,
    pesoActual: redondear(pesoKg),
    pesoObjetivo,
    cambio,
    imcActual: redondear(imcActual),
    imcObjetivo: redondear(imcObjetivo),
    explicacion: explicar(enfoque, cambio, meses, pesoObjetivo),
    // Con kilos puestos a mano el enfoque puede cambiar: si en recomposicion
    // el entrenador pide bajar 4 kilos, hay que describirlo como bajada.
    descripcionFisica: describir(
      aMano && cambio < 0 ? "bajar" : aMano && cambio > 0 ? "subir" : enfoque,
      Math.abs(cambio),
      pesoKg,
    ),
    topeKilos,
    aMano,
  };
}

function explicar(enfoque: Enfoque, cambio: number, meses: number, objetivo: number): string {
  const plazo = `${meses} ${meses === 1 ? "mes" : "meses"}`;
  if (enfoque === "recomposicion") {
    return `Tu peso ya está en un rango saludable, así que en ${plazo} lo que más va a cambiar no es el número de la balanza sino la forma: menos grasa y más músculo, con el peso casi igual.`;
  }
  if (enfoque === "subir") {
    return `En ${plazo} podrías llegar a ${objetivo} kg sumando masa muscular, entrenando con constancia y comiendo lo que indica tu plan.`;
  }
  return `En ${plazo} podrías llegar a unos ${objetivo} kg, bajando alrededor de ${Math.abs(cambio)} kg, si sostenés el entrenamiento y el plan de comidas.`;
}

/**
 * Lo que se le pide al modelo de imagen.
 *
 * ⚠️ LA INTENSIDAD DEL TEXTO TIENE QUE ESCALAR CON LOS KILOS. Esto se
 * descubrio probando: pidiendole "having lost about 15 kg" pero diciendole en
 * la misma frase "moderately slimmer" y "keep it modest", el modelo devolvia
 * un cambio de 5 o 6 kilos. El numero sube y las palabras lo frenan.
 *
 * Por eso el adjetivo sale de cuanto representa la bajada sobre el peso de la
 * persona, no de un texto fijo. Bajar 5 kilos no es lo mismo para alguien de
 * 60 que para alguien de 120.
 */
function describir(enfoque: Enfoque, kilos: number, pesoActual: number): string {
  const parte = pesoActual > 0 ? kilos / pesoActual : 0;

  if (enfoque === "recomposicion") {
    return "the same body weight but a slightly more toned and firm appearance: marginally more defined arms and shoulders, a slightly flatter midsection. The change must be subtle and natural, the kind of difference a few months of consistent training produces. NOT an athletic or fitness-model physique.";
  }

  if (enfoque === "subir") {
    const cuanto = parte > 0.08 ? "noticeably fuller and stronger" : "slightly fuller and healthier";
    return `a ${cuanto} build, having gained about ${kilos} kg, mostly as muscle on the shoulders, chest and arms. Natural looking, not a bodybuilder physique.`;
  }

  // Bajar. Tres escalones segun cuanto pesa la bajada sobre el cuerpo.
  if (parte >= 0.12) {
    return `a SUBSTANTIALLY slimmer body, having lost ${kilos} kg of body fat. This is a major, immediately obvious transformation: a clearly narrower waist and midsection, visibly slimmer hips and thighs, noticeably thinner arms, and a distinctly slimmer face and neck. The difference must be unmistakable at a glance. Still an ordinary person with a natural body, not an athlete and not a fitness model.`;
  }
  if (parte >= 0.05) {
    return `a clearly and noticeably slimmer body, having lost ${kilos} kg of body fat: a distinctly narrower waist and midsection, slimmer arms and thighs, a slimmer face. The change should be obvious when compared side by side, like a real person after several months of gym and diet. Not a fitness model, no visible abs.`;
  }
  return `a slightly slimmer build, having lost about ${kilos} kg of body fat: a somewhat slimmer waist and midsection, a slightly less full face. A subtle, natural change. Not a fitness model, no visible abs.`;
}

/**
 * El ritmo real de esta persona, en kilos por mes, mirando su historial.
 *
 * Devuelve null si no hay con qué: con un solo registro no hay tendencia, y con
 * menos de tres semanas entre el primero y el último, el ruido de la balanza
 * (comida, agua, hora del día) pesa más que el cambio real.
 */
export function ritmoReal(pesos: { date: string; weight_kg: number }[]): number | null {
  if (!pesos || pesos.length < 2) return null;
  const orden = [...pesos].sort((a, b) => a.date.localeCompare(b.date));
  const primero = orden[0];
  const ultimo = orden[orden.length - 1];
  const dias = (new Date(ultimo.date).getTime() - new Date(primero.date).getTime()) / 86400000;
  if (dias < 21) return null;
  return ((ultimo.weight_kg - primero.weight_kg) / dias) * 30;
}
