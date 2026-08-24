import type { Metadata, Viewport } from "next";
import "./globals.css";
import { THEMES, cssVarsOf } from "@/lib/theme";

/**
 * Anti-parpadeo del estilo.
 *
 * El estilo de cada negocio se sabe recién cuando carga su ficha, así que sin
 * esto la app pintaría con el estilo por defecto y recién después cambiaría al
 * real: en un estudio de pilates se veía un flash cian antes del rosa.
 *
 * Guardamos el último estilo visto en localStorage (lo hace ThemeApply) y acá
 * lo aplicamos ANTES del primer pintado, con un script chiquito e inline. Si no
 * hay nada guardado, quedan los valores por defecto de globals.css.
 */
const THEME_VARS = JSON.stringify(Object.fromEntries(THEMES.map((t) => [t.key, cssVarsOf(t)])));
const PRE_PAINT = `try{var k=localStorage.getItem("tg-theme"),m=${THEME_VARS};if(k&&m[k]){var s=document.documentElement.style,v;for(v in m[k])s.setProperty(v,m[k][v])}}catch(e){}`;

export const metadata: Metadata = {
  title: "turnogym",
  description: "Software premium para gimnasios",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "turnogym",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
