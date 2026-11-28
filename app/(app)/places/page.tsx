import { headers } from "next/headers";
import Link from "next/link";
import { CalendarCheck, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { courtBookings, places, sessions, users } from "@/db/schema";
import { PlacesClient } from "./places-client";
import { BookingsPanel } from "./bookings-panel";
import { timeZoneForOwner, usablePlaceOwners } from "@/lib/bookings/places";

export default async function PlacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const tx = await getTranslations("ui.s_reservaspistas_page");

  // Monitor de un club: las pistas del club se ven aquí en solo lectura
  // (las da de alta y las gestiona el administrador del club).
  const { clubOwnerId, clubName } = await usablePlaceOwners(user.id);
  const clubPlaces =
    clubOwnerId && clubOwnerId !== user.id
      ? await db
          .select({ id: places.id, name: places.name })
          .from(places)
          .where(and(eq(places.coachId, clubOwnerId), ne(places.coachId, user.id)))
          .orderBy(places.name)
      : [];

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      description: places.description,
      createdAt: sql<string>`${places.createdAt}::text`,
      updatedAt: sql<string>`${places.updatedAt}::text`,
      totalSessions: sql<number>`COUNT(${sessions.id})::int`,
      upcomingSessions: sql<number>`COUNT(${sessions.id}) FILTER (WHERE ${sessions.scheduledAt} >= now())::int`,
      totalMinutes: sql<number>`COALESCE(SUM(${sessions.durationMinutes}), 0)::int`,
      lastScheduledAt: sql<string | null>`MAX(${sessions.scheduledAt})::text`,
    })
    .from(places)
    .leftJoin(
      sessions,
      and(eq(sessions.placeId, places.id), eq(sessions.userId, user.id))
    )
    .where(eq(places.coachId, user.id))
    .groupBy(places.id)
    .orderBy(places.name);

  // Reserva pública: ajustes de cada pista, enlace y próximas reservas.
  const [bookingPlaces, [owner], upcoming] = await Promise.all([
    db
      .select({
        id: places.id,
        name: places.name,
        bookingEnabled: places.bookingEnabled,
        bookingOpenMinute: places.bookingOpenMinute,
        bookingCloseMinute: places.bookingCloseMinute,
      })
      .from(places)
      .where(eq(places.coachId, user.id))
      .orderBy(places.name),
    db
      .select({ token: users.bookingToken })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
    db
      .select({
        id: courtBookings.id,
        placeName: places.name,
        startAt: courtBookings.startAt,
        durationMinutes: courtBookings.durationMinutes,
        fullName: courtBookings.fullName,
        kind: courtBookings.kind,
      })
      .from(courtBookings)
      .innerJoin(places, eq(places.id, courtBookings.placeId))
      .where(
        and(
          eq(courtBookings.ownerId, user.id),
          isNull(courtBookings.cancelledAt),
          gte(courtBookings.startAt, new Date(Date.now() - 3 * 3600_000))
        )
      )
      .orderBy(asc(courtBookings.startAt))
      .limit(50),
  ]);
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "www.tenplanner.com";
  const proto = h.get("x-forwarded-proto") ?? "https";

  return (
    <div className="tp-page">
      <div className="tp-page-pad">
        {clubPlaces.length > 0 && (
          <section className="tp-panel mb-5 p-5">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground/70">
              <Lock className="size-4" />
              {tx("pistasDelClubTitulo", { club: clubName ?? "" })}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tx("pistasDelClubExplicacion")}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {clubPlaces.map((p) => (
                <li
                  key={p.id}
                  className="rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold text-foreground"
                >
                  {p.name}
                </li>
              ))}
            </ul>
            <Link
              href="/reservas-pistas"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline"
            >
              <CalendarCheck className="size-4" />
              {tx("verOcupacionPistasClub")}
            </Link>
          </section>
        )}
        <BookingsPanel
          key={bookingPlaces.map((p) => p.id).join(",")}
          places={bookingPlaces}
          bookings={upcoming.map((b) => ({
            ...b,
            startAt: b.startAt.toISOString(),
          }))}
          bookingPath={owner?.token ? `/reservar/${owner.token}` : null}
          origin={`${proto}://${host}`}
          timeZone={await timeZoneForOwner(user.id)}
        />
        <PlacesClient initialPlaces={rows} />
      </div>
    </div>
  );
}
