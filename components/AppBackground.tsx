/** Fondo de la app, teñido con el color del gimnasio. Capa fija detrás de todo
 * (z-index -1). El estilo lo elige el dueño: aurora / suave / solido. */
export default function AppBackground({ style = "aurora" }: { style?: string | null }) {
  const cls = style === "solido" ? "app-bg-solido" : style === "suave" ? "app-bg-suave" : "app-bg-aurora";
  return <div className={`app-bg ${cls}`} aria-hidden="true" />;
}
