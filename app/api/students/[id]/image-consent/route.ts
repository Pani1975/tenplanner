import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { students } from "@/db/schema";
import { getManageableStudent } from "@/lib/guardians";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  // true = autoriza, false = no autoriza, null = sin datos.
  consent: z.boolean().nullable(),
  on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  ref: z.string().trim().max(200).nullable().optional(),
});

// Autorización de imagen del alumno (vale para todo, no solo torneos).
// Solo quien puede gestionar al alumno en su modo de trabajo.
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const student = await getManageableStudent(user.id, id);
  if (!student) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const d = parsed.data;
  const [row] = await db
    .update(students)
    .set({
      imageConsent: d.consent,
      // Sin datos: se borran también la fecha y la referencia.
      imageConsentOn: d.consent === null ? null : (d.on ?? null),
      imageConsentRef: d.consent === null ? null : d.ref || null,
      imageConsentBy: user.id,
    })
    .where(eq(students.id, id))
    .returning({
      imageConsent: students.imageConsent,
      imageConsentOn: students.imageConsentOn,
      imageConsentRef: students.imageConsentRef,
    });
  return NextResponse.json({ data: row });
}
