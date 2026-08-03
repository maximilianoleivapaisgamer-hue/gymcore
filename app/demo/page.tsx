import DemoChooser from "@/components/DemoChooser";

export const metadata = {
  title: "Probá turnogym — demo sin registro",
  description: "Entrá a la demo de turnogym sin crear cuenta: probá el panel del dueño y la app del socio.",
};

/** Demo pública (la marcada en el panel). El prospecto elige y entra sin clave. */
export default function DemoPage() {
  return <DemoChooser ownerHref="/demo/entrar?rol=owner" socioHref="/demo/entrar?rol=socio" />;
}
