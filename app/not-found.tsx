import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-1">
        <p className="font-heading text-[8rem] leading-none font-bold text-foreground/8 select-none">
          404
        </p>
      </div>
      <div className="space-y-2 -mt-6">
        <h1 className="font-heading text-2xl font-semibold">
          Página no encontrada
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          La página que buscas no existe o ha sido movida.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
