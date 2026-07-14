import type { SupabaseClient } from "@supabase/supabase-js";
import { saveRoutine, saveDiet, type AIRoutine, type AIDiet } from "@/lib/ai/persist";

/**
 * Datos de ejemplo para un gimnasio DEMO.
 *
 * Siempre son LOS MISMOS 10 socios (curados), con estados variados: algunos
 * activos, otros por vencer y otros vencidos. Se les cargan rutinas, dietas,
 * clases y movimientos de caja para que el panel y la app se vean con vida.
 * Las fechas se calculan relativas a hoy para que la mezcla activo/por-vencer/
 * vencido se mantenga siempre.
 */

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function monthDay(monthsAgo: number, day: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(day)}`;
}

interface SeedMember { full_name: string; dni: string; plan: string; price: number; wa: string; exp: number; }

// exp = días hasta el vencimiento (negativo = ya vencido).
const MEMBERS: SeedMember[] = [
  { full_name: "Martina Gómez", dni: "32111222", plan: "Full", price: 24000, wa: "5491133330001", exp: 35 },
  { full_name: "Diego Ramírez", dni: "30222333", plan: "Libre", price: 18000, wa: "5491133330002", exp: 12 },
  { full_name: "Sofía López", dni: "34333444", plan: "Full", price: 24000, wa: "5491133330003", exp: 5 },
  { full_name: "Lucas Fernández", dni: "29444555", plan: "Trimestral", price: 60000, wa: "5491133330004", exp: 58 },
  { full_name: "Camila Torres", dni: "35555666", plan: "Full", price: 24000, wa: "5491133330005", exp: 2 },
  { full_name: "Nicolás Díaz", dni: "28666777", plan: "Libre", price: 18000, wa: "5491133330006", exp: -3 },
  { full_name: "Valentina Ruiz", dni: "36777888", plan: "Full", price: 24000, wa: "5491133330007", exp: -9 },
  { full_name: "Mateo Sánchez", dni: "27888999", plan: "Libre", price: 18000, wa: "5491133330008", exp: 20 },
  { full_name: "Julieta Herrera", dni: "37999000", plan: "Full", price: 24000, wa: "5491133330009", exp: 45 },
  { full_name: "Bruno Castro", dni: "26000111", plan: "Trimestral", price: 60000, wa: "5491133330010", exp: -1 },
];

const ROUTINE_A: AIRoutine = {
  name: "Full Body 3 días",
  resumen: "Rutina de cuerpo completo 3 veces por semana. Subí el peso cuando llegues al tope de reps con buena técnica.",
  days: [
    { name: "Día 1 — Full A", blocks: [
      { name: "A — Fuerza", rows: [{ exercise: "Sentadilla", sets: "4", reps: "8-10" }, { exercise: "Press de banca", sets: "4", reps: "8-10" }] },
      { name: "B — Accesorios", rows: [{ exercise: "Remo con barra", sets: "3", reps: "10-12" }, { exercise: "Plancha abdominal", sets: "3", reps: "40 seg" }] },
    ] },
    { name: "Día 2 — Full B", blocks: [
      { name: "A — Fuerza", rows: [{ exercise: "Peso muerto", sets: "4", reps: "6-8" }, { exercise: "Press militar", sets: "4", reps: "8-10" }] },
      { name: "B — Accesorios", rows: [{ exercise: "Dominadas asistidas", sets: "3", reps: "8-10" }, { exercise: "Curl de bíceps", sets: "3", reps: "12" }] },
    ] },
    { name: "Día 3 — Full C", blocks: [
      { name: "A — Piernas", rows: [{ exercise: "Prensa 45°", sets: "4", reps: "10-12" }, { exercise: "Zancadas", sets: "3", reps: "12 x pierna" }] },
      { name: "B — Core", rows: [{ exercise: "Elevación de piernas", sets: "3", reps: "15" }] },
    ] },
  ],
};

const ROUTINE_B: AIRoutine = {
  name: "Hipertrofia 4 días",
  resumen: "Split de 4 días (empuje / tirón / pierna / full). Enfocado en volumen muscular. Descansá 60-90s entre series.",
  days: [
    { name: "Día 1 — Empuje", blocks: [{ name: "Pecho y hombro", rows: [{ exercise: "Press inclinado", sets: "4", reps: "8-12" }, { exercise: "Aperturas", sets: "3", reps: "12-15" }, { exercise: "Elevaciones laterales", sets: "4", reps: "15" }] }] },
    { name: "Día 2 — Tirón", blocks: [{ name: "Espalda", rows: [{ exercise: "Jalón al pecho", sets: "4", reps: "10-12" }, { exercise: "Remo en polea", sets: "4", reps: "12" }, { exercise: "Curl de bíceps", sets: "3", reps: "12" }] }] },
    { name: "Día 3 — Pierna", blocks: [{ name: "Tren inferior", rows: [{ exercise: "Sentadilla", sets: "4", reps: "8-10" }, { exercise: "Prensa 45°", sets: "4", reps: "12" }, { exercise: "Femoral acostado", sets: "3", reps: "12-15" }] }] },
    { name: "Día 4 — Full", blocks: [{ name: "Cuerpo completo", rows: [{ exercise: "Peso muerto", sets: "3", reps: "6-8" }, { exercise: "Press militar", sets: "3", reps: "10" }, { exercise: "Plancha abdominal", sets: "3", reps: "45 seg" }] }] },
  ],
};

const DIET_A: AIDiet = {
  name: "Plan definición",
  resumen: "Plan orientado a bajar grasa manteniendo músculo. Es una guía general de ejemplo; ante dudas consultá a un nutricionista.",
  days: [
    { name: "Día 1", meals: [
      { meal_type: "Desayuno", title: "Avena con frutas", detail: "60g de avena, 1 banana, 200ml de leche descremada. ~380 kcal." },
      { meal_type: "Almuerzo", title: "Pollo con arroz y ensalada", detail: "150g de pechuga, 100g de arroz, ensalada libre. ~520 kcal." },
      { meal_type: "Merienda", title: "Yogur con nueces", detail: "1 yogur descremado + 20g de nueces. ~250 kcal." },
      { meal_type: "Cena", title: "Tortilla de claras y verduras", detail: "4 claras + 1 huevo, verduras salteadas. ~320 kcal." },
    ] },
    { name: "Día 2", meals: [
      { meal_type: "Desayuno", title: "Tostadas con queso untable", detail: "2 tostadas integrales + queso untable + café. ~340 kcal." },
      { meal_type: "Almuerzo", title: "Carne magra con puré de calabaza", detail: "150g de carne, puré de calabaza, ensalada. ~500 kcal." },
      { meal_type: "Cena", title: "Ensalada completa con atún", detail: "Atún al agua, huevo, verduras, aceite de oliva. ~380 kcal." },
    ] },
  ],
};

const DIET_B: AIDiet = {
  name: "Plan volumen",
  resumen: "Plan con superávit calórico para ganar masa muscular. Guía general de ejemplo; ajustá con un profesional.",
  days: [
    { name: "Día 1", meals: [
      { meal_type: "Desayuno", title: "Huevos revueltos con avena", detail: "3 huevos, 80g de avena, 1 banana. ~600 kcal." },
      { meal_type: "Almuerzo", title: "Pasta con carne", detail: "120g de pasta, 150g de carne picada, salsa. ~750 kcal." },
      { meal_type: "Merienda", title: "Batido proteico", detail: "1 scoop de proteína, 300ml de leche, avena. ~450 kcal." },
      { meal_type: "Cena", title: "Milanesa de pollo al horno con puré", detail: "Pechuga rebozada al horno + puré de papa. ~700 kcal." },
    ] },
  ],
};

const CLASSES = [
  { name: "Funcional", weekdays: ["lun", "mie", "vie"], start_time: "08:00", duration: 60, capacity: 16, color: "#22d3ee" },
  { name: "Spinning", weekdays: ["mar", "jue"], start_time: "19:00", duration: 45, capacity: 18, color: "#3b82f6" },
  { name: "Crosstraining", weekdays: ["lun", "mie", "vie"], start_time: "20:00", duration: 60, capacity: 12, color: "#818cf8" },
  { name: "Boxeo", weekdays: ["mar", "jue"], start_time: "21:00", duration: 60, capacity: 14, color: "#f5b13d" },
  { name: "Yoga & Movilidad", weekdays: ["sab"], start_time: "11:00", duration: 60, capacity: 15, color: "#22c55e" },
];

const COBRO = ["efectivo", "transferencia", "terminal"];

/** Carga los datos de ejemplo en un gimnasio demo (best-effort). */
export async function seedDemoGym(admin: SupabaseClient, gymId: string, sedeId: string | null): Promise<void> {
  try {
    // 1) Socios
    const rows = MEMBERS.map((m) => ({
      gym_id: gymId, full_name: m.full_name, dni: m.dni, plan_name: m.plan,
      plan_price: m.price, whatsapp: m.wa, membership_expiry: isoOffset(m.exp),
    }));
    const { data: inserted } = await admin.from("members").insert(rows).select("id, full_name, plan_price, membership_expiry");
    const members = (inserted as { id: string; full_name: string; plan_price: number; membership_expiry: string }[]) || [];

    // 2) Rutinas para ~5 socios (alternando A/B)
    for (let i = 0; i < Math.min(6, members.length); i++) {
      const rt = i % 2 === 0 ? ROUTINE_A : ROUTINE_B;
      await saveRoutine(admin, gymId, { memberId: members[i].id, memberName: members[i].full_name }, rt).catch(() => {});
    }
    // 3) Dietas para ~4 socios
    for (let i = 0; i < Math.min(4, members.length); i++) {
      const dt = i % 2 === 0 ? DIET_A : DIET_B;
      await saveDiet(admin, gymId, { memberId: members[i].id, memberName: members[i].full_name }, dt).catch(() => {});
    }

    // 4) Clases
    await admin.from("classes").insert(CLASSES.map((c) => ({ ...c, gym_id: gymId, sede_id: sedeId }))).then(() => {}, () => {});

    // 5) Caja: cuotas de los últimos 3 meses + algunos egresos → el gráfico muestra datos
    const cash: Record<string, unknown>[] = [];
    for (let mo = 0; mo < 3; mo++) {
      members.forEach((m, i) => {
        cash.push({
          gym_id: gymId, sede_id: sedeId, member_id: m.id,
          concept: `Cuota — ${m.full_name}`, type: "income",
          amount: Number(m.plan_price) || 20000, method: COBRO[i % COBRO.length],
          date: monthDay(mo, 3 + (i % 20)),
        });
      });
      cash.push({ gym_id: gymId, sede_id: sedeId, concept: "Alquiler", type: "expense", amount: 220000, method: "transferencia", date: monthDay(mo, 5) });
      cash.push({ gym_id: gymId, sede_id: sedeId, concept: "Mantenimiento y limpieza", type: "expense", amount: 45000, method: "efectivo", date: monthDay(mo, 15) });
    }
    await admin.from("cashflow_entries").insert(cash).then(() => {}, () => {});
  } catch {
    /* el demo igual queda creado; los datos son best-effort */
  }
}
