import type { Config } from "tailwindcss";

/** Sistema de diseño GymCore — mismos tokens que el prototipo aprobado. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0d12",
        surface: "#12161d",
        "surface-2": "#171c25",
        "surface-3": "#1d2431",
        brand: "rgb(var(--brand-rgb) / <alpha-value>)",
        "brand-2": "rgb(var(--brand-2-rgb) / <alpha-value>)",
        indigo: "#818cf8",
        good: "#22c55e",
        warn: "#f5b13d",
        crit: "#f05252",
        ink: "#f4f6f8",
        "ink-2": "#9aa3b2",
        muted: "#6b7280",
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
