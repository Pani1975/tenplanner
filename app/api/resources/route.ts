import { and, desc, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { resources, users } from "@/db/schema";
import {
  getActiveWorkClubId,
  getClubAccountClubId,
  sharedWithClubCondition,
} from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  title: z.string().trim().min(1, "Título obligatorio").max(255),
  description: z.string().trim().max(4000).optional().nullable(),
  url: z
    .string()
    .trim()
    .url("Enlace no válido")
    .max(2000)
    .optional()
    .nullable(),
  documentUrl: z.string().trim().url().max(2000).optional().nullable(),
  documentName: z.string().trim().max(255).optional().nullable(),
  imageUrl: z.string().trim().url().max(2000).optional().nullable(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Particular: solo los míos. Club: los de todos los miembros del club.
  const activeClubId = await getActiveWorkClubId(user.id);
  let visible = sharedWithClubCondition(
    resources.userId,
    resources.clubId,
    user.id,
    activeClubId
  );
  // Una cuenta de club no tiene espacio particular: los recursos que creó
  // antes de que existiera "Recursos club" (sin club asignado) siguen siendo
  // suyos y deben verse en su carpeta.
  if (activeClubId && (await getClubAccountClubId(user.id))) {
    visible = or(
      visible,
      and(eq(resources.userId, user.id), isNull(resources.clubId))
    )!;
  }
  const rows = await db
    .select({ resource: resources, authorName: users.name })
    .from(resources)
    .innerJoin(users, eq(users.id, resources.userId))
    .where(visible)
    .orderBy(desc(resources.createdAt));

  return NextResponse.json({
    data: rows.map((r) => ({ ...r.resource, authorName: r.authorName })),
  });
}

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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  const [created] = await db
    .insert(resources)
    .values({
      userId: user.id,
      clubId: await getActiveWorkClubId(user.id),
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      url: parsed.data.url ?? null,
      documentUrl: parsed.data.documentUrl ?? null,
      documentName: parsed.data.documentName ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
    })
    .returning();

  return NextResponse.json({ data: created }, { status: 201 });
}
