import ViendoComo from "@/components/ViendoComo";

/**
 * Envoltorio de la app del socio. Solo agrega el cartel de "estás viendo como…"
 * para cuando el super admin entra a mirar la app de un socio de un cliente.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ViendoComo />
    </>
  );
}
