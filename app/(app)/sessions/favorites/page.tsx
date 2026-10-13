import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadFavoriteSessionLists } from "@/lib/sessions/favorites";
import { FavoritesClient } from "./favorites-client";

export default async function FavoriteSessionsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const lists = await loadFavoriteSessionLists(user.id);

  return (
    <div className="min-h-full w-full space-y-6 bg-[#F4F4F1] px-4 py-8 dark:bg-[#050505] sm:px-6 md:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Heart className="size-3.5 text-red-400" />
            Sesiones
          </p>
          <h1 className="text-3xl font-black text-foreground sm:text-4xl">
            Listas
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Tus sesiones guardadas, organizadas por listas. Pulsa el corazón en
            cualquier sesión para añadirla a una lista.
          </p>
        </div>
        <Link
          href="/sessions"
          className="inline-flex items-center justify-center rounded-full border border-border bg-white/70 px-4 py-2 text-sm font-semibold text-muted-foreground hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-white/[0.035]"
        >
          Ver mis sesiones
        </Link>
      </header>

      {lists === null ? (
        <p className="rounded-2xl border border-border bg-white/70 p-6 text-sm text-muted-foreground dark:bg-white/[0.035]">
          Las listas de sesiones favoritas todavía no están activadas. El
          administrador debe pulsar «Activar sesiones favoritas» en Admin →
          Herramientas.
        </p>
      ) : (
        <FavoritesClient initialLists={lists} />
      )}
    </div>
  );
}
