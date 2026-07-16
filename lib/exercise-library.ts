/**
 * Lista curada de ejercicios para la librería global de turnogym.
 *
 * Cada entrada se cruza (por nombre) contra la base pública Free Exercise DB
 * (dominio público) para tomar sus 2 fotos (inicio/fin). Acá definimos el
 * nombre en español, los músculos, el equipo, el nivel y una guía corta.
 *
 * `en` = nombre tal como figura en la base (para poder encontrarlo).
 */
export interface CuratedExercise {
  en: string;
  es: string;
  muscles: string[];
  equipment: string;
  level: "Principiante" | "Intermedio" | "Avanzado";
  cue: string[];
}

export const CURATED: CuratedExercise[] = [
  // ── Piernas ──────────────────────────────────────────────
  { en: "Barbell Squat", es: "Sentadilla con barra", muscles: ["Cuádriceps", "Glúteos"], equipment: "Barra", level: "Principiante",
    cue: ["Barra sobre la espalda alta, pies al ancho de hombros.", "Bajá con pecho arriba hasta el muslo casi paralelo al piso.", "Empujá con los talones para subir."] },
  { en: "Front Barbell Squat", es: "Sentadilla frontal", muscles: ["Cuádriceps"], equipment: "Barra", level: "Intermedio",
    cue: ["Barra apoyada adelante sobre los hombros, codos altos.", "Bajá manteniendo el torso vertical.", "Subí empujando con las piernas."] },
  { en: "Barbell Lunge", es: "Estocada con barra", muscles: ["Cuádriceps", "Glúteos"], equipment: "Barra", level: "Intermedio",
    cue: ["Da un paso adelante y bajá la rodilla de atrás hacia el piso.", "El torso derecho, la rodilla no pasa la punta del pie.", "Volvé empujando con la pierna de adelante."] },
  { en: "Romanian Deadlift", es: "Peso muerto rumano", muscles: ["Isquiotibiales", "Glúteos"], equipment: "Barra", level: "Intermedio",
    cue: ["Espalda recta, llevá la cadera atrás bajando la barra pegada a las piernas.", "Sentí el estiramiento en la parte de atrás del muslo.", "Volvé llevando la cadera adelante."] },
  { en: "Leg Extensions", es: "Extensión de cuádriceps", muscles: ["Cuádriceps"], equipment: "Máquina", level: "Principiante",
    cue: ["Sentado, estirá las piernas contrayendo el cuádriceps.", "Pausa arriba 1 segundo.", "Bajá lento controlando."] },
  { en: "Lying Leg Curls", es: "Curl femoral acostado", muscles: ["Isquiotibiales"], equipment: "Máquina", level: "Principiante",
    cue: ["Boca abajo, llevá los talones hacia los glúteos.", "Contraé arriba.", "Bajá lento."] },
  { en: "Standing Calf Raises", es: "Elevación de talones de pie", muscles: ["Gemelos"], equipment: "Máquina", level: "Principiante",
    cue: ["Elevá los talones lo más alto posible.", "Pausa arriba apretando el gemelo.", "Bajá con el talón por debajo del escalón."] },

  // ── Pecho ────────────────────────────────────────────────
  { en: "Barbell Bench Press - Medium Grip", es: "Press de banca", muscles: ["Pecho"], equipment: "Barra", level: "Principiante",
    cue: ["Acostado, agarre medio, bajá la barra al medio del pecho.", "Empujá con el pecho hasta estirar los brazos.", "Bajar tarda el doble que subir."] },
  { en: "Barbell Incline Bench Press - Medium Grip", es: "Press inclinado con barra", muscles: ["Pecho superior"], equipment: "Barra", level: "Principiante",
    cue: ["Banco inclinado ~30°, bajá la barra a la parte alta del pecho.", "Empujá hacia arriba y adentro.", "Controlá la bajada."] },
  { en: "Dumbbell Flyes", es: "Aperturas con mancuernas", muscles: ["Pecho"], equipment: "Mancuernas", level: "Intermedio",
    cue: ["Acostado, abrí los brazos con codos levemente flexionados.", "Sentí el estiramiento del pecho.", "Cerrá como abrazando."] },
  { en: "Pushups", es: "Flexiones de brazos", muscles: ["Pecho", "Tríceps"], equipment: "Peso corporal", level: "Principiante",
    cue: ["Cuerpo recto, manos al ancho de hombros.", "Bajá el pecho cerca del piso.", "Empujá manteniendo el abdomen firme."] },

  // ── Espalda ──────────────────────────────────────────────
  { en: "Barbell Deadlift", es: "Peso muerto", muscles: ["Zona lumbar", "Glúteos", "Isquiotibiales"], equipment: "Barra", level: "Intermedio",
    cue: ["Espalda recta, agarrá la barra al ancho de hombros.", "Empujá con las piernas y llevá el torso a vertical.", "Bajá controlando, la barra pegada al cuerpo."] },
  { en: "Bent Over Barbell Row", es: "Remo con barra", muscles: ["Espalda media", "Dorsales"], equipment: "Barra", level: "Principiante",
    cue: ["Torso inclinado, espalda recta.", "Llevá la barra al abdomen juntando las escápulas.", "Bajá controlando."] },
  { en: "Pullups", es: "Dominadas", muscles: ["Dorsales", "Bíceps"], equipment: "Peso corporal", level: "Intermedio",
    cue: ["Colgado, agarre prono al ancho de hombros.", "Traccioná hasta pasar el mentón la barra.", "Bajá controlando hasta estirar."] },
  { en: "Wide-Grip Lat Pulldown", es: "Jalón al pecho (agarre ancho)", muscles: ["Dorsales"], equipment: "Máquina", level: "Principiante",
    cue: ["Agarre ancho, llevá la barra al pecho.", "Codos hacia abajo, juntá las escápulas.", "Subí controlando."] },
  { en: "Seated Cable Rows", es: "Remo en polea sentado", muscles: ["Espalda media"], equipment: "Polea", level: "Principiante",
    cue: ["Espalda recta, traccioná el mango al abdomen.", "Juntá las escápulas.", "Estirá controlando adelante."] },
  { en: "One-Arm Dumbbell Row", es: "Remo con mancuerna a un brazo", muscles: ["Dorsales", "Espalda media"], equipment: "Mancuernas", level: "Principiante",
    cue: ["Apoyado en el banco, espalda recta.", "Llevá la mancuerna a la cadera.", "Bajá controlando."] },

  // ── Hombros ──────────────────────────────────────────────
  { en: "Standing Military Press", es: "Press militar de pie", muscles: ["Hombros"], equipment: "Barra", level: "Intermedio",
    cue: ["Barra a la altura del pecho, abdomen firme.", "Empujá arriba hasta estirar los brazos.", "Bajá controlando al pecho."] },
  { en: "Arnold Dumbbell Press", es: "Press Arnold", muscles: ["Hombros"], equipment: "Mancuernas", level: "Intermedio",
    cue: ["Empezá con las palmas hacia vos.", "Subí girando las muñecas hasta estirar arriba.", "Bajá girando de vuelta."] },
  { en: "Side Lateral Raise", es: "Elevaciones laterales", muscles: ["Hombros"], equipment: "Mancuernas", level: "Principiante",
    cue: ["Brazos a los costados, codos leves.", "Subí hasta la altura de los hombros.", "Bajá lento."] },
  { en: "Front Dumbbell Raise", es: "Elevaciones frontales", muscles: ["Hombros"], equipment: "Mancuernas", level: "Principiante",
    cue: ["Mancuernas adelante de los muslos.", "Subí una al frente hasta la altura del hombro.", "Bajá controlando y alterná."] },
  { en: "Face Pull", es: "Face pull", muscles: ["Hombros", "Espalda alta"], equipment: "Polea", level: "Intermedio",
    cue: ["Cuerda a la altura de la cara.", "Traccioná separando las manos hacia la frente.", "Volvé controlando."] },

  // ── Bíceps ───────────────────────────────────────────────
  { en: "Barbell Curl", es: "Curl con barra", muscles: ["Bíceps"], equipment: "Barra", level: "Principiante",
    cue: ["Codos pegados al torso.", "Subí la barra contrayendo el bíceps.", "Bajá lento sin balancear."] },
  { en: "Dumbbell Bicep Curl", es: "Curl con mancuernas", muscles: ["Bíceps"], equipment: "Mancuernas", level: "Principiante",
    cue: ["Palmas al frente, codos fijos.", "Subí contrayendo el bíceps.", "Bajá controlando."] },
  { en: "Alternate Hammer Curl", es: "Curl martillo alternado", muscles: ["Bíceps", "Antebrazo"], equipment: "Mancuernas", level: "Principiante",
    cue: ["Palmas mirando el cuerpo, codos fijos.", "Subí una mancuerna al hombro.", "Bajá y alterná."] },
  { en: "Concentration Curls", es: "Curl concentrado", muscles: ["Bíceps"], equipment: "Mancuernas", level: "Principiante",
    cue: ["Sentado, codo apoyado en el muslo.", "Subí concentrando la contracción.", "Bajá lento."] },

  // ── Tríceps ──────────────────────────────────────────────
  { en: "Triceps Pushdown", es: "Extensión de tríceps en polea", muscles: ["Tríceps"], equipment: "Polea", level: "Principiante",
    cue: ["Codos pegados al torso.", "Estirá los brazos hacia abajo.", "Volvé controlando."] },
  { en: "Dips - Triceps Version", es: "Fondos para tríceps", muscles: ["Tríceps", "Pecho"], equipment: "Peso corporal", level: "Intermedio",
    cue: ["Cuerpo vertical en las paralelas.", "Bajá flexionando los codos.", "Empujá hasta estirar."] },
  { en: "Lying Triceps Press", es: "Press francés", muscles: ["Tríceps"], equipment: "Barra", level: "Intermedio",
    cue: ["Acostado, bajá la barra hacia la frente.", "Solo se mueven los antebrazos.", "Estirá arriba."] },
  { en: "Tricep Dumbbell Kickback", es: "Patada de tríceps", muscles: ["Tríceps"], equipment: "Mancuernas", level: "Principiante",
    cue: ["Torso inclinado, codo alto y fijo.", "Estirá el brazo hacia atrás.", "Volvé controlando."] },

  // ── Core / Abdomen ───────────────────────────────────────
  { en: "Crunches", es: "Abdominales (crunch)", muscles: ["Abdomen"], equipment: "Peso corporal", level: "Principiante",
    cue: ["Boca arriba, rodillas flexionadas.", "Elevá los hombros contrayendo el abdomen.", "Bajá lento."] },
  { en: "Plank", es: "Plancha", muscles: ["Abdomen", "Core"], equipment: "Peso corporal", level: "Principiante",
    cue: ["Apoyado en antebrazos y puntas de pie.", "Cuerpo recto, abdomen y glúteos firmes.", "Sostené el tiempo indicado."] },
  { en: "Hanging Leg Raise", es: "Elevación de piernas colgado", muscles: ["Abdomen"], equipment: "Peso corporal", level: "Intermedio",
    cue: ["Colgado de la barra.", "Subí las piernas hasta la horizontal.", "Bajá controlando sin balancear."] },
  { en: "Russian Twist", es: "Giro ruso", muscles: ["Oblicuos", "Abdomen"], equipment: "Peso corporal", level: "Principiante",
    cue: ["Sentado, torso inclinado atrás.", "Girá el torso de lado a lado.", "Controlá el movimiento."] },
];
