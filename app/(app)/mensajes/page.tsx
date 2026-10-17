import { redirect } from "next/navigation";
import { MessageSquare, Megaphone, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Avisos del club (fase 1). La visibilidad la decide RLS en Supabase
// (migración 0054_avisos_familias): staff del club ve los de su club;
// las familias, solo los de los grupos de sus hijos.

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  group_id: string | null;
  created_at: string;
  allow_replies: boolean;
  groups: { name: string } | null;
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function MensajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("announcements")
    .select(
      "id, title, body, group_id, created_at, allow_replies, groups(name)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  // Si la tabla aún no existe o falla la consulta, se muestra el estado vacío.
  const announcements = error
    ? []
    : ((data ?? []) as unknown as AnnouncementRow[]);

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <MessageSquare className="size-3.5" />
            Comunicación del club
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Mensajes
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            Avisos del club a monitores y familias: cambios de horario, sesiones
            canceladas e información de cada grupo.
          </p>
        </header>

        <div className="tp-panel p-5 sm:p-6">
          {announcements.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand/10">
                <Megaphone className="size-5 text-foreground/60" />
              </span>
              <p className="text-base font-black text-foreground">
                Aún no hay mensajes
              </p>
              <p className="max-w-sm text-sm leading-6 text-foreground/60">
                Aquí aparecerán los avisos de tu club y de tus grupos.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li
                  key={a.id}
                  className="rounded-2xl border border-[#050505]/10 p-4 dark:border-white/10"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/70">
                      {a.group_id ? (
                        <Users2 className="size-3" />
                      ) : (
                        <Megaphone className="size-3" />
                      )}
                      {a.group_id
                        ? (a.groups?.name ?? "Tu grupo")
                        : "Todo el club"}
                    </span>
                    <time
                      dateTime={a.created_at}
                      className="text-[11px] font-semibold tabular-nums text-foreground/50"
                    >
                      {dateFormatter.format(new Date(a.created_at))}
                    </time>
                  </div>
                  <h2 className="mt-2 text-base font-black text-foreground">
                    {a.title}
                  </h2>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground/70">
                    {a.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
