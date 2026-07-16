/**
 * Traducción del vocabulario fijo de Free Exercise DB al español.
 * (Músculos, equipo, nivel y categoría son un conjunto cerrado → mapa directo,
 * sin IA. Los NOMBRES e INSTRUCCIONES sí se traducen con IA en el seed.)
 */

export const MUSCLE_ES: Record<string, string> = {
  abdominals: "Abdominales", abductors: "Abductores", adductors: "Aductores",
  biceps: "Bíceps", calves: "Gemelos", chest: "Pecho", forearms: "Antebrazos",
  glutes: "Glúteos", hamstrings: "Isquiotibiales", lats: "Dorsales",
  "lower back": "Zona lumbar", "middle back": "Espalda media", neck: "Cuello",
  quadriceps: "Cuádriceps", shoulders: "Hombros", traps: "Trapecios", triceps: "Tríceps",
};

export const EQUIP_ES: Record<string, string> = {
  "body only": "Peso corporal", machine: "Máquina", other: "Otro", cable: "Polea",
  barbell: "Barra", dumbbell: "Mancuernas", kettlebells: "Kettlebell", bands: "Bandas",
  "medicine ball": "Pelota medicinal", "exercise ball": "Pelota de ejercicio",
  "e-z curl bar": "Barra Z", "foam roll": "Rodillo",
};

export const LEVEL_ES: Record<string, string> = {
  beginner: "Principiante", intermediate: "Intermedio", expert: "Avanzado",
};

export const CATEGORY_ES: Record<string, string> = {
  strength: "Fuerza", stretching: "Elongación", plyometrics: "Pliometría",
  strongman: "Strongman", powerlifting: "Powerlifting", cardio: "Cardio",
  "olympic weightlifting": "Halterofilia",
};

export const muscleEs = (m: string) => MUSCLE_ES[m?.toLowerCase?.()] || m;
export const equipEs = (e: string | null | undefined) => (e ? EQUIP_ES[e.toLowerCase()] || e : null);
export const levelEs = (l: string | null | undefined) => (l ? LEVEL_ES[l.toLowerCase()] || l : null);
export const categoryEs = (c: string | null | undefined) => (c ? CATEGORY_ES[c.toLowerCase()] || c : null);
export const musclesEs = (arr: string[] | null | undefined) => (arr || []).map(muscleEs);

/** Normaliza el nombre de un ejercicio: recortado y con la primera letra en
 * mayúscula (para que todos queden consistentes al cargarlos). */
export function capExercise(s: string): string {
  const t = (s || "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
