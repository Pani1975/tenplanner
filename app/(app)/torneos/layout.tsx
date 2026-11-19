import { dmSans } from "@/app/fonts/dm-sans";

// Torneos: tema azul y DM Sans solo en esta sección (ver .tp-torneos).
export default function TorneosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${dmSans.variable} tp-torneos tp-page`}>{children}</div>
  );
}
