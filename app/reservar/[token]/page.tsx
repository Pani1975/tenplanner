import { notFound } from "next/navigation";
import { and, eq, count } from "drizzle-orm";
import { db } from "@/db";
import { places } from "@/db/schema";
import { getBookingOwner } from "@/lib/bookings/server";
import { bookingDays } from "@/lib/bookings/availability";
import { BookingClient } from "./booking-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  const owner = await getBookingOwner(token);
  return {
    title: owner ? `Reservar pista · ${owner.displayName}` : "Reservar pista",
    robots: { index: false, follow: false },
  };
}

// Página pública (sin cuenta) para reservar las pistas de un club o monitor.
export default async function BookingPage({ params }: PageProps) {
  const { token } = await params;
  const owner = await getBookingOwner(token);
  if (!owner) notFound();

  const [row] = await db
    .select({ total: count() })
    .from(places)
    .where(and(eq(places.coachId, owner.id), eq(places.bookingEnabled, true)));

  return (
    <div className="min-h-[100dvh] bg-[#F4F4F1] text-[#050505] dark:bg-[#050505] dark:text-white">
      <header className="bg-[#050505] px-5 pb-8 pt-6 text-white">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-black uppercase tracking-widest text-[#D6FF38]">
            Reserva de pistas
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight">
            {owner.displayName}
          </h1>
        </div>
      </header>
      <main className="mx-auto -mt-4 max-w-xl rounded-t-[28px] bg-[#F4F4F1] px-4 pb-16 pt-6 dark:bg-[#050505]">
        {Number(row?.total ?? 0) === 0 ? (
          <p className="rounded-2xl border border-[#050505]/10 bg-white p-5 text-sm text-[#050505]/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
            Ahora mismo no hay pistas disponibles para reservar.
          </p>
        ) : (
          <BookingClient token={token} days={bookingDays(new Date())} />
        )}
        <p className="mt-10 text-center text-[11px] text-[#050505]/45 dark:text-white/40">
          Reservas con ten<span className="font-bold">planner</span>
        </p>
      </main>
    </div>
  );
}
