import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  GuardianError,
  getManageableStudent,
  listGuardians,
  regenerateGuardianInvite,
  revokeGuardian,
} from "@/lib/guardians";

type Context = { params: Promise<{ id: string; guardianId: string }> };

const bodySchema = z.object({ action: z.enum(["regenerate", "revoke"]) });

export async function PATCH(request: Request, context: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, guardianId } = await context.params;
  const uuid = z.string().uuid();
  if (!uuid.safeParse(id).success || !uuid.safeParse(guardianId).success) {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  }
  const student = await getManageableStudent(user.id, id);
  if (!student) {
    return NextResponse.json(
      { error: "Alumno no encontrado" },
      { status: 404 }
    );
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "regenerate") {
      await regenerateGuardianInvite(student.id, guardianId);
    } else {
      await revokeGuardian(student.id, guardianId);
    }
    return NextResponse.json({ data: await listGuardians(student.id) });
  } catch (error) {
    if (error instanceof GuardianError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("[guardians] update failed", error);
    return NextResponse.json(
      { error: "No se pudo actualizar el contacto." },
      { status: 500 }
    );
  }
}
