import { redirect } from "next/navigation";
import {
  GraduationCap,
  Megaphone,
  MessageSquare,
  Send,
  User,
  Users,
  Users2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getMessagingContext,
  listRecipientOptions,
  listVisibleMessages,
  type Audience,
  type MessageListItem,
} from "@/lib/messages";
import { SPORT_LABELS } from "@/lib/sport-constants";
import { MessageComposer } from "./message-composer";
import { MarkMessagesRead } from "./mark-read";
import { isFamilyOnlyUser } from "@/lib/family";
import { isFamilyAccountType } from "@/lib/family-account";

// Mensajes del club. Quién envía y quién lee lo deciden las funciones de
// la base de datos (migraciones 0054 y 0055), vía lib/messages.ts.

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const AUDIENCE_ICON: Record<Audience, React.ElementType> = {
  club: Megaphone,
  group: Users2,
  student: GraduationCap,
  coaches: Users,
  coach: User,
};

async function loadMessages(userId: string): Promise<MessageListItem[]> {
  try {
    return await listVisibleMessages(userId);
  } catch (error) {
    // p. ej. si las migraciones de mensajes aún no están aplicadas
    console.error("[mensajes] list failed", error);
    return [];
  }
}

export default async function MensajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [ctx, familyOnly] = await Promise.all([
    getMessagingContext(user.id).catch(() => null),
    isFamilyOnlyUser(user.id, isFamilyAccountType(user.user_metadata)).catch(
      () => false
    ),
  ]);
  const canCompose = !!ctx?.clubId && ctx.isClubAdmin;
  const [messages, options] = await Promise.all([
    loadMessages(user.id),
    canCompose
      ? listRecipientOptions(ctx!.clubId!, ctx!.sport).catch(() => null)
      : null,
  ]);

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
            {familyOnly
              ? "Los avisos del club: cambios de horario, sesiones canceladas e información de tu grupo."
              : "Mensajes del club a sus monitores, a los grupos y a cada alumno. Con los alumnos menores, la comunicación es siempre con sus padres o tutores."}
          </p>
        </header>

        {canCompose && options && (
          <section className="tp-panel p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground/70">
              <Send className="size-4" />
              Nuevo mensaje
            </h2>
            <MessageComposer
              options={options}
              sportLabel={SPORT_LABELS[ctx!.sport]}
            />
          </section>
        )}

        {!ctx?.clubId && !familyOnly && (
          <p className="rounded-2xl border border-[#050505]/10 px-4 py-3 text-sm text-foreground/65 dark:border-white/10">
            Para enviar mensajes del club, cambia a modo club desde el selector
            de modo de trabajo.
          </p>
        )}

        <MarkMessagesRead
          ids={messages.filter((m) => m.unread).map((m) => m.id)}
        />
        <section className="tp-panel p-5 sm:p-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand/10">
                <Megaphone className="size-5 text-foreground/60" />
              </span>
              <p className="text-base font-black text-foreground">
                Aún no hay mensajes
              </p>
              <p className="max-w-sm text-sm leading-6 text-foreground/60">
                Aquí aparecerán los mensajes que envíes y los que recibas del
                club.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => {
                const Icon = AUDIENCE_ICON[m.audience];
                return (
                  <li
                    key={m.id}
                    className={
                      m.unread
                        ? "rounded-2xl border border-brand/60 bg-brand/5 p-4"
                        : "rounded-2xl border border-[#050505]/10 p-4 dark:border-white/10"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {m.unread && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                          Nuevo
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/70">
                        <Icon className="size-3" />
                        {m.sentByMe ? `Para: ${m.targetLabel}` : m.targetLabel}
                      </span>
                      {!m.sentByMe && m.authorName && (
                        <span className="text-[11px] font-semibold text-foreground/60">
                          De {m.authorName}
                        </span>
                      )}
                      <time
                        dateTime={m.createdAt.toISOString()}
                        className="text-[11px] font-semibold tabular-nums text-foreground/50"
                      >
                        {dateFormatter.format(m.createdAt)}
                      </time>
                    </div>
                    <h3 className="mt-2 text-base font-black text-foreground">
                      {m.title}
                    </h3>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground/70">
                      {m.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
