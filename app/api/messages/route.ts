import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  AUDIENCES,
  MessagePermissionError,
  getMessagingContext,
  sendMessage,
} from "@/lib/messages";

const sendSchema = z
  .object({
    audience: z.enum(AUDIENCES),
    recipientUserId: z.string().uuid().nullish(),
    groupId: z.string().uuid().nullish(),
    studentId: z.string().uuid().nullish(),
    title: z.string().trim().min(1).max(140),
    body: z.string().trim().min(1).max(4000),
    allowReplies: z.boolean().optional(),
  })
  .refine(
    (v) =>
      (v.audience !== "coach" || !!v.recipientUserId) &&
      (v.audience !== "group" || !!v.groupId) &&
      (v.audience !== "student" || !!v.studentId),
    { message: "Falta el destinatario" }
  );

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 400 }
    );
  }

  const ctx = await getMessagingContext(user.id);
  if (!ctx.clubId) {
    return NextResponse.json(
      { error: "Cambia a modo club para enviar mensajes." },
      { status: 403 }
    );
  }

  try {
    const row = await sendMessage(user.id, ctx.clubId, ctx.sport, parsed.data);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (error) {
    if (error instanceof MessagePermissionError) {
      return NextResponse.json(
        { error: "No puedes enviar este mensaje a ese destinatario." },
        { status: 403 }
      );
    }
    console.error("[messages] send failed", error);
    return NextResponse.json(
      { error: "No se pudo enviar el mensaje." },
      { status: 500 }
    );
  }
}
