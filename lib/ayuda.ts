/**
 * Centro de ayuda: los artículos y el buscador.
 *
 * Un solo archivo alimenta las dos cosas: el buscador (que no cuesta nada) y el
 * chat con IA (que le pasa estos mismos textos como contexto). Si agregás una
 * función a la app, escribí el artículo acá y queda contestada en los dos lados.
 *
 * Cómo escribirlos:
 *  - En criollo, como se lo explicarías a la dueña por teléfono.
 *  - Decí DÓNDE está la cosa ("Configuración → Reservas de clases"), que es el
 *    90% de lo que preguntan.
 *  - `claves` son las palabras con las que la gente busca, no las que usamos
 *    nosotros: alguien busca "faltar" cuando la función se llama "cancelación".
 */

export interface Articulo {
  id: string;
  categoria: string;
  titulo: string;
  /** Palabras con las que la gente busca esto. */
  claves: string[];
  /** El texto. Los saltos de línea dobles separan párrafos. */
  cuerpo: string;
}

export const CATEGORIAS = [
  "Para empezar",
  "Socios y cobros",
  "Clases y reservas",
  "Tu página web",
  "La app de tus socios",
  "Tu cuenta",
] as const;

export const ARTICULOS: Articulo[] = [
  // ── Para empezar ──────────────────────────────────────────────────────
  {
    id: "por-donde-empezar",
    categoria: "Para empezar",
    titulo: "¿Por dónde empiezo?",
    claves: ["empezar", "arrancar", "primeros pasos", "configurar", "nuevo", "inicio"],
    cuerpo:
      "En el panel, arriba de todo, tenés la lista de Puesta en marcha con lo que te falta. Va tildando solo a medida que cargás cosas y desaparece cuando terminás.\n\nEl orden que menos vueltas te da: primero tus planes y precios, después tus clases, después tus socios. Con eso ya podés cobrar y que tus socios reserven.",
  },
  {
    id: "planes-precios",
    categoria: "Para empezar",
    titulo: "Cargar tus planes y precios",
    claves: ["plan", "planes", "precio", "precios", "pack", "abono", "cuota", "tarifa"],
    cuerpo:
      "Panel → Planes. Cada plan lleva un nombre (\"PACK 1\", \"Pase Libre\"), un precio y, si querés, cuántas clases incluye por mes.\n\nEl campo Clases es el tope: si lo dejás vacío o en 0, ese plan es ilimitado. También podés elegir qué actividades entran en cada plan, para casos como \"el Pase Libre no incluye Kangoo Jumps\".",
  },
  {
    id: "cargar-clases",
    categoria: "Para empezar",
    titulo: "Cargar tus clases",
    claves: ["clase", "clases", "horario", "horarios", "grilla", "agenda", "actividad"],
    cuerpo:
      "Panel → Clases → + Nueva clase. Cargás una fila por horario: nombre, días, hora, duración, cupo y profe.\n\nSi tenés Zumba lunes, miércoles y viernes a las 8:30 y también martes y jueves a las 13:30, son dos clases distintas. Tus socios no las ven repetidas: la app las agrupa por día.",
  },

  // ── Socios y cobros ───────────────────────────────────────────────────
  {
    id: "alta-socio",
    categoria: "Socios y cobros",
    titulo: "Dar de alta un socio",
    claves: ["socio", "socia", "alumno", "alumna", "alta", "agregar", "nuevo socio", "dni"],
    cuerpo:
      "Panel → Socios → Agregar socio. Lo mínimo es el nombre y el DNI: con el DNI entra a su app (es el usuario y también la contraseña la primera vez).\n\nSi le cargás el WhatsApp podés mandarle el acceso de una y, si tenés los recordatorios prendidos, avisarle cuando le vence la cuota.",
  },
  {
    id: "cobrar-cuota",
    categoria: "Socios y cobros",
    titulo: "Cobrar una cuota",
    claves: ["cobrar", "cobro", "pago", "pagar", "plata", "caja", "ingreso"],
    cuerpo:
      "En la ficha del socio tocás Cobrar. Elegís a qué mes corresponde y el monto viene puesto según su plan, pero lo podés cambiar.\n\nCobrar hace dos cosas a la vez: registra la plata en Finanzas y le corre el vencimiento al socio. Si el socio te sigue figurando vencido después de cobrarle, avisanos.",
  },
  {
    id: "cuando-vence",
    categoria: "Socios y cobros",
    titulo: "Cuándo les vence la cuota",
    claves: ["vencimiento", "vence", "vencido", "fecha", "mes", "dia fijo", "aniversario"],
    cuerpo:
      "Configuración → Cobros. Hay dos formas y elegís la de tu negocio.\n\n\"Un mes desde que paga\": cada socio tiene su propia fecha. Paga el 20, le vence el 20 del mes que viene. Es lo típico de gimnasio.\n\n\"Todos el mismo día\": a todos les vence el mismo día del mes, como cuando decís \"las cuotas se pagan del 1 al 10\". Es lo típico de estudios de clases.",
  },
  {
    id: "recargo",
    categoria: "Socios y cobros",
    titulo: "Cobrar recargo al que paga tarde",
    claves: ["recargo", "interes", "tarde", "atraso", "atrasado", "multa", "punitorio"],
    cuerpo:
      "Configuración → Cobros → Recargo por pagar tarde. Podés poner un monto fijo en pesos o un porcentaje de la cuota.\n\nCuando le cobrás a alguien atrasado, la pantalla te propone el monto con el recargo ya sumado. Nunca se cobra solo: siempre lo podés borrar o cambiar antes de confirmar.",
  },
  {
    id: "clase-suelta",
    categoria: "Socios y cobros",
    titulo: "Vender una clase suelta",
    claves: ["clase suelta", "suelta", "una clase", "probar", "invitada", "extra"],
    cuerpo:
      "Se prende en Configuración → Cobros → Vender clases sueltas, con un precio sugerido que después podés pisar en cada venta.\n\nAparece el botón \"Vender clase suelta\" en la ficha del socio. No le mueve el vencimiento de la cuota: es una clase extra, no un mes.\n\nAl venderla elegís si le suma un cupo (para que la reserve desde su app) o si solo registrás la plata, para cuando la clase es hoy y ya está en la puerta. Los cupos extra se acumulan y no se pierden al renovar.",
  },

  {
    id: "comisiones-profes",
    categoria: "Socios y cobros",
    titulo: "Cuánto le toca a cada profe (comisiones)",
    claves: ["comision", "comisiones", "profe", "profesor", "profesora", "porcentaje", "liquidacion", "pagarle al profe", "sueldo", "reparto"],
    cuerpo:
      "Panel → Comisiones. Elegís el mes y te muestra cuánto le corresponde a cada profe. Está en los planes Pro y Elite.\n\nCómo lo calcula: lo que pagó CADA socio se reparte entre las profes según cuántas clases hizo con cada una. Si hizo 8 clases con Karina y 4 con Priscila, Karina se lleva dos tercios de esa cuota y Priscila un tercio — no mitad y mitad. Después cada profe cobra su porcentaje de esa parte.\n\nEl porcentaje lo cambiás ahí mismo, en la columna \"Su %\": la que recién entra suele ir al 40% y el resto al 50%. Se guarda solo. La profe que no tocaste va con 50%.\n\nLas profes salen de lo que cargaste en cada clase, en Clases → Editar clase → Profesor. La clase sin profe cargada no se le atribuye a nadie.\n\nSe cuentan las RESERVAS del mes, no las asistencias. Si tenés prendida la regla de cancelación, una clase reservada y no cancelada a tiempo ya se le descontó al socio, así que cuenta como clase dada.\n\nSi te aparece \"plata sin profe asignada\", son socios que pagaron y no reservaron ninguna clase ese mes. Esa plata no se le da a nadie, y te conviene mirar la lista: alguien que paga y no viene es alguien que se te está por ir.",
  },

  // ── Clases y reservas ─────────────────────────────────────────────────
  {
    id: "tope-clases-plan",
    categoria: "Clases y reservas",
    titulo: "Cuántas clases incluye cada plan",
    claves: ["tope", "limite", "cuantas clases", "cupo del plan", "pack", "12 clases"],
    cuerpo:
      "Panel → Planes, campo Clases. Es cuántas puede reservar el socio por mes con ese plan. Vacío o 0 = ilimitado, para los planes tipo \"Pase Libre\".\n\nEl socio ve en su app cuántas le quedan. Vos no tenés ese tope: desde Clases podés anotarlo igual aunque se haya pasado (te avisa, pero te deja).",
  },
  {
    id: "actividades-del-plan",
    categoria: "Clases y reservas",
    titulo: "Qué actividades entran en cada plan",
    claves: ["actividades", "incluida", "no incluida", "excepto", "solo", "kangoo"],
    cuerpo:
      "Panel → Planes. Cada plan puede ser \"todas las actividades\", \"todas menos estas\" o \"solo estas\". Tildás de una lista de lo que ya cargaste en Clases, no hace falta escribir nada.\n\nEjemplo real: un Pase Libre que incluye todo menos Kangoo Jumps porque las botas las pone el estudio, y un plan aparte que es solo Kangoo.\n\nSi le cambiás el nombre a una actividad, revisá los planes que la nombraban: la pantalla te avisa cuando un plan apunta a algo que ya no existe.",
  },
  {
    id: "anticipacion-reservas",
    categoria: "Clases y reservas",
    titulo: "Con cuánta anticipación pueden reservar",
    claves: [
      "anticipacion", "cada cuanto", "frecuencia", "semana", "mes", "reservar antes",
      "con cuanto tiempo", "calendario",
    ],
    cuerpo:
      "Configuración → Reservas de clases → Con cuánta anticipación pueden reservar. Elegís entre solo esta semana, 2, 3 semanas, un mes, mes y medio o dos meses.\n\nEl número incluye la semana en curso: \"Un mes\" quiere decir ésta y las tres que siguen.\n\nEn la app, tus socios se mueven entre semanas con las flechitas que están arriba de los días. Esto define hasta dónde llegan.",
  },
  {
    id: "plazo-cancelar",
    categoria: "Clases y reservas",
    titulo: "Poner un plazo para cancelar",
    claves: [
      "cancelar", "cancelacion", "plazo", "2 horas", "avisar", "faltar", "no vino",
      "pierde la clase", "se borra",
    ],
    cuerpo:
      "Configuración → Reservas de clases → Poner un plazo para cancelar. Elegís cuántas horas antes del inicio pueden cancelar; lo más común son 2.\n\nUna clase de las 19:00 se puede cancelar hasta las 17:00. Después ya no, y si la socia no va, esa clase le cuenta igual y le descuenta una del pack. Es lo que hace que se anoten en serio.\n\nA vos no te frena: desde Clases sacás a alguien de una reserva cuando quieras, aunque el plazo haya pasado.",
  },
  {
    id: "reservar-vencido",
    categoria: "Clases y reservas",
    titulo: "No dejar reservar si debe la cuota",
    claves: ["vencido", "debe", "deudor", "sin pagar", "bloquear", "no puede reservar"],
    cuerpo:
      "Configuración → Reservas de clases → Solo hasta que les vence la cuota. Con eso prendido, nadie se anota a clases de un mes que todavía no pagó.\n\nOjo con la contracara: un socio que ya está vencido no puede reservar ninguna clase hasta que renueve. Si en tu negocio se paga unos días tarde, tenelo en cuenta.\n\nA los socios que no tenés con vencimiento cargado no los frena.",
  },
  {
    id: "foto-clase",
    categoria: "Clases y reservas",
    titulo: "Ponerle una foto a cada clase",
    claves: ["foto", "imagen", "portada", "clase con foto"],
    cuerpo:
      "Panel → Clases → tocás la clase → Editar clase → Foto. La ven tus socios al lado del nombre cuando eligen a qué anotarse.\n\nEs opcional y no queda feo si no ponés ninguna: si ninguna de tus clases tiene foto, la lista va sin recuadros. Si le ponés a algunas, las otras muestran la inicial en su color.",
  },
  {
    id: "vista-semana",
    categoria: "Clases y reservas",
    titulo: "Ver la semana completa y los huecos",
    claves: ["semana", "calendario", "huecos", "grilla", "vista semanal", "libre"],
    cuerpo:
      "Panel → Clases, arriba a la derecha, el interruptor Tarjetas / Semana.\n\nLa vista Semana pone cada clase en su lugar según la hora y la duración, así los espacios libres se ven en blanco y de una sabés dónde te entra una clase nueva. Tocando un bloque se abre el panel de reservas de esa clase.",
  },
  {
    id: "lista-de-espera",
    categoria: "Clases y reservas",
    titulo: "Lista de espera: cuando la clase está llena",
    claves: ["lista de espera", "espera", "llena", "completa", "sin lugar", "cupo lleno", "avisame", "se libero", "cancelo alguien"],
    cuerpo:
      "No tenés que hacer nada: ya viene prendida en todas las clases que tengan cupo cargado.\n\nCuando una clase está completa, a tus socios les aparece \"Avisame si se libera\" en vez de un botón muerto. Si después alguien cancela, al PRIMERO de la fila le llega un aviso al celular y el lugar le queda guardado 30 minutos para que confirme. Nadie más lo puede tomar en ese rato.\n\nSi no lo confirma, pasa al final de la fila y el lugar se le ofrece al que sigue. Así no se te queda una clase con un lugar vacío porque el que esperaba no miró el teléfono.\n\nNo se lo anotamos directo a propósito: si tenés la regla de cancelación prendida, anotar a alguien sin que se entere le podría hacer perder una clase del pack por no llegar a cancelar.\n\nVos la ves en Panel → Clases → tocás la clase: abajo de los anotados aparece la lista de espera con el orden y quién tiene el lugar guardado en ese momento.",
  },
  {
    id: "anotar-socio",
    categoria: "Clases y reservas",
    titulo: "Anotar vos a un socio en una clase",
    claves: ["anotar", "reservar por el socio", "inscribir", "lista", "quien viene"],
    cuerpo:
      "Panel → Clases → tocás la clase. Ahí ves quién está anotado para la próxima fecha y tenés el desplegable \"Anotar socio\".\n\nA vos ninguna regla te frena: podés pasarte del cupo de la sala o del tope del plan, anotar a alguien vencido o sacar una reserva fuera del plazo de cancelación. Los topes son solo para lo que el socio hace desde su app.",
  },

  // ── Tu página web ─────────────────────────────────────────────────────
  {
    id: "pagina-web",
    categoria: "Tu página web",
    titulo: "Tu página web pública",
    claves: ["pagina", "web", "sitio", "landing", "link", "publicar"],
    cuerpo:
      "Panel → Página pública. Ahí cargás el logo, la portada, la galería de fotos, la dirección, los planes que mostrás y los textos.\n\nEs una página con tu marca y tu propio link, para mandar por WhatsApp o poner en el Instagram. Se actualiza sola cada vez que guardás.",
  },
  {
    id: "sincronizar-clases-web",
    categoria: "Tu página web",
    titulo: "Que la web muestre tus clases sin cargarlas dos veces",
    claves: ["sincronizar", "web", "grilla en la web", "dos veces", "actualizar"],
    cuerpo:
      "Panel → Página pública → Clases → tildá \"Usar las clases que ya cargué en el panel\".\n\nCon eso la web muestra tu grilla real y se actualiza sola: si agregás o sacás una clase en el panel, allá cambia sin que toques nada. Si preferís mostrar otra cosa en la web, destildalo y la cargás a mano.",
  },

  // ── La app de tus socios ──────────────────────────────────────────────
  {
    id: "como-entran-socios",
    categoria: "La app de tus socios",
    titulo: "Cómo entran tus socios a la app",
    claves: ["socio", "entrar", "login", "acceso", "clave", "contraseña", "instalar", "app"],
    cuerpo:
      "Tu socio entra con su DNI como usuario y, la primera vez, el mismo DNI como contraseña. Después la cambia desde Mi cuenta.\n\nDesde su celular puede tocar \"Instalar app\" y le queda el ícono en la pantalla de inicio, como cualquier aplicación. No hay que bajar nada de ninguna tienda.",
  },
  {
    id: "como-ven-clases",
    categoria: "La app de tus socios",
    titulo: "Cómo ven las clases tus socios",
    claves: ["como ven", "app del socio", "reservar", "dias", "solapas"],
    cuerpo:
      "Ven las clases por día, no todas juntas. Arriba eligen el día con las solapas y abajo aparece solo lo de ese día, ordenado por hora, con el profe y cuántos lugares quedan.\n\nCon las flechitas se mueven de semana. Una clase de hoy que ya empezó no la pueden reservar.",
  },
  {
    id: "colores-app",
    categoria: "La app de tus socios",
    titulo: "Cambiar los colores de la app",
    claves: ["color", "colores", "estilo", "tema", "marca", "diseño", "personalizar"],
    cuerpo:
      "Configuración → Estilo de la app. Hay cinco estilos y cambian la app entera, tuya y la de tus socios: celeste, rosa, fucsia, verde y ámbar.\n\nAl costado tenés una vista previa de cómo lo van a ver tus socios, con tu nombre y tu logo. Se ve al instante, pero se guarda recién cuando tocás Guardar.",
  },
  {
    id: "secciones",
    categoria: "La app de tus socios",
    titulo: "Elegir qué secciones se ven",
    claves: ["secciones", "ocultar", "apagar", "menu", "esconder", "no uso"],
    cuerpo:
      "Configuración, más abajo. Son dos listas separadas.\n\n\"Secciones de tu panel\": lo que apagues desaparece de tu menú de la izquierda. Si no usás Dietas, sacala y dejás de verla.\n\n\"Lo que ven tus clientes en la app\": es aparte. Podés seguir usando una sección vos y aun así ocultársela a tus socios.",
  },

  // ── Tu cuenta ─────────────────────────────────────────────────────────
  {
    id: "mi-usuario",
    categoria: "Tu cuenta",
    titulo: "Cambiar tu usuario y tu contraseña",
    claves: ["usuario", "contraseña", "clave", "cambiar", "mi cuenta", "acceso"],
    cuerpo:
      "Panel → Mi cuenta. Ahí cambiás tu usuario y tu contraseña, y también subís el ícono de la app.\n\nSi te olvidaste la contraseña y no podés entrar, escribinos por WhatsApp y te la reiniciamos.",
  },
  {
    id: "sucursales",
    categoria: "Tu cuenta",
    titulo: "Trabajar con más de una sucursal",
    claves: ["sucursal", "sede", "local", "sucursales", "dos locales"],
    cuerpo:
      "Panel → Sucursales. Cargás cada local y después, arriba a la derecha, elegís en cuál estás trabajando.\n\nLas clases, las reservas y los movimientos de caja quedan guardados en la sucursal que tenías elegida al cargarlos, así cada local tiene sus números por separado.",
  },
  {
    id: "equipo",
    categoria: "Tu cuenta",
    titulo: "Darle acceso a tu equipo",
    claves: ["equipo", "empleado", "profe", "profesor", "recepcion", "permisos"],
    cuerpo:
      "Panel → Equipo. Creás una cuenta para cada persona y le tildás qué puede hacer: cobrar, cargar socios, ver la caja, anotar en clases.\n\nCada uno entra con su usuario, así sabés quién hizo qué. Los empleados no ven la configuración del negocio ni tu plan.",
  },
  {
    id: "recordatorios-whatsapp",
    categoria: "Tu cuenta",
    titulo: "Recordatorios automáticos por WhatsApp",
    claves: ["whatsapp", "recordatorio", "aviso", "automatico", "vencimiento", "mensaje"],
    cuerpo:
      "Panel → Recordatorios automáticos. Es del plan Pro. Le avisa solo a los socios que están por vencer, desde el número de tu negocio, y elegís con cuántos días de anticipación.\n\nSi estás en Básico, igual podés mandar el recordatorio a mano desde la ficha de cada socio: te abre el WhatsApp con el mensaje escrito.",
  },
  {
    id: "mi-plan",
    categoria: "Tu cuenta",
    titulo: "Tu plan de TurnoGym",
    claves: ["mi plan", "plan", "basico", "pro", "elite", "pagar", "factura", "abono"],
    cuerpo:
      "Panel → Mi plan. Ahí ves qué plan tenés, qué incluye, cuándo vence y cómo lo estás pagando.\n\nLas funciones que tu plan no incluye aparecen con un candado en el menú. Si necesitás alguna suelta sin cambiar de plan, escribinos y te la habilitamos.",
  },
];

/** Saca acentos y mayúsculas, para que "cuánto" encuentre "cuanto". */
function normalizar(t: string): string {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Busca artículos. Ordena por qué tan bien pegan, no alfabéticamente.
 *
 * Puntaje: el título vale más que las palabras clave, y las claves más que el
 * cuerpo. Así "cancelar" trae primero el artículo de cancelación y no el de
 * cobros, que también dice la palabra.
 */
export function buscarAyuda(consulta: string, tope = 8): Articulo[] {
  const q = normalizar(consulta);
  if (!q) return [];
  const palabras = q.split(/\s+/).filter((p) => p.length > 2);
  if (palabras.length === 0) palabras.push(q);

  return ARTICULOS.map((a) => {
    const titulo = normalizar(a.titulo);
    const claves = normalizar(a.claves.join(" "));
    const cuerpo = normalizar(a.cuerpo);
    let puntos = 0;
    for (const p of palabras) {
      if (titulo.includes(p)) puntos += 10;
      if (claves.includes(p)) puntos += 6;
      if (cuerpo.includes(p)) puntos += 2;
    }
    // La frase entera dentro de un título es la mejor señal que hay.
    if (titulo.includes(q)) puntos += 15;
    if (claves.includes(q)) puntos += 8;
    return { a, puntos };
  })
    .filter((x) => x.puntos > 0)
    .sort((x, y) => y.puntos - x.puntos)
    .slice(0, tope)
    .map((x) => x.a);
}

/** Todos los artículos en texto plano, para pasárselos a la IA como contexto. */
export function ayudaComoTexto(): string {
  return ARTICULOS.map(
    (a) => `## ${a.titulo}\n(sección: ${a.categoria})\n${a.cuerpo}`,
  ).join("\n\n");
}
