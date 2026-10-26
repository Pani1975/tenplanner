import { and, isNotNull, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  clubCoachProfiles,
  drPlannerChats,
  drPlannerMessages,
  students,
} from "@/db/schema";

const CHAT_RETENTION_DAYS = 180;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(
    Date.now() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const now = new Date();

  const deletedChats = await db
    .delete(drPlannerChats)
    .where(lt(drPlannerChats.updatedAt, cutoff))
    .returning({ id: drPlannerChats.id });

  const orphanMessages = await db
    .delete(drPlannerMessages)
    .where(lt(drPlannerMessages.createdAt, cutoff))
    .returning({ id: drPlannerMessages.id });

  const expiredTokens = await db
    .update(students)
    .set({ profileToken: null, profileTokenExpiresAt: null })
    .where(
      and(
        isNotNull(students.profileToken),
        lt(students.profileTokenExpiresAt, now)
      )
    )
    .returning({ id: students.id });

  const expiredCoachLinks = await db
    .update(clubCoachProfiles)
    .set({ profileToken: null, profileTokenExpiresAt: null })
    .where(
      and(
        isNotNull(clubCoachProfiles.profileToken),
        lt(clubCoachProfiles.profileTokenExpiresAt, now)
      )
    )
    .returning({ id: clubCoachProfiles.id });

  const summary = {
    ranAt: now.toISOString(),
    cutoff: cutoff.toISOString(),
    chatsDeleted: deletedChats.length,
    messagesDeleted: orphanMessages.length,
    expiredTokensInvalidated: expiredTokens.length + expiredCoachLinks.length,
  };

  console.info("[cron/cleanup]", JSON.stringify(summary));

  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
}
