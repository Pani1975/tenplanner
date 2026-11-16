import { and, count, eq, gte, isNull, lt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  // Un tramo por día (inicio y fin del día local del navegador).
  days: z
    .array(z.object({ from: z.string().datetime(), to: z.string().datetime() }))
    .min(1)
    .max(130),
  excludeSessionId: z.string().uuid().nullable().optional(),
});

/**
 * Cuántas sesiones sin grupo (clases sueltas) tiene ya el monitor cada día,
 * para numerar el nombre automático: AAMMDD_SG, AAMMDD_SG2… No guarda nada.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const counts = await Promise.all(
    parsed.data.days.map(async (day) => {
      const [row] = await db
        .select({ n: count() })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, user.id),
            isNull(sessions.groupId),
            ne(sessions.status, "cancelled"),
            gte(sessions.scheduledAt, new Date(day.from)),
            lt(sessions.scheduledAt, new Date(day.to)),
            parsed.data.excludeSessionId
              ? ne(sessions.id, parsed.data.excludeSessionId)
              : undefined
          )
        );
      return row?.n ?? 0;
    })
  );
  return NextResponse.json({ data: { counts } });
}
