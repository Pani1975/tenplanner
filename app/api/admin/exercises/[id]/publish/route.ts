import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { isPlatformAdmin } from "@/lib/exercise-access";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ id: string }> };

const bodySchema = z.object({ published: z.boolean() });

/**
 * Publica o retira de la biblioteca un ejercicio de Ten Planner (global).
 * Solo el administrador. Un ejercicio sin publicar no se lista en la
 * biblioteca, el buscador, Dr. Planner ni las propuestas de sesión.
 */
export async function PATCH(request: Request, { params }: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdmin(user.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Id no válido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  }

  const [row] = await db
    .update(exercises)
    .set({ isPublished: parsed.data.published })
    .where(and(eq(exercises.id, id), eq(exercises.isGlobal, true)))
    .returning({ id: exercises.id, isPublished: exercises.isPublished });

  if (!row) {
    return NextResponse.json(
      { error: "Ejercicio de Ten Planner no encontrado" },
      { status: 404 }
    );
  }

  revalidatePath("/exercises");
  revalidatePath(`/exercises/${id}`);
  revalidatePath("/admin/content");

  return NextResponse.json({ data: row });
}
