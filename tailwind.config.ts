import type { Config } from "tailwindcss";

/** Sistema de diseño GymCore — mismos tokens que el prototipo aprobado. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Toda la paleta base es variable: la reescribe ThemeApply según el
           estilo elegido (ver lib/theme.ts). Así cambiar de estilo repinta la
           app entera sin tocar los ~830 usos de estas clases. */
        bg: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2-rgb) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3-rgb) / <alpha-value>)",
        brand: "rgb(var(--brand-rgb) / <alpha-value>)",
        "brand-2": "rgb(var(--brand-2-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        "ink-2": "rgb(var(--ink-2-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        /* Los de estado no cambian con el estilo: rojo es rojo en los cinco. */
        indigo: "#818cf8",
        good: "#22c55e",
        warn: "#f5b13d",
        crit: "#f05252",
      },
      borderRadius: { xl: "16px" },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
