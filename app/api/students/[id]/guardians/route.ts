import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  GuardianError,
  createGuardian,
  getManageableStudent,
  listGuardians,
} from "@/lib/guardians";
import { GUARDIAN_RELATIONSHIPS } from "@/lib/guardian-labels";

type Context = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email no válido")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  relationship: z.enum(GUARDIAN_RELATIONSHIPS),
});

async function authorize(context: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return {
      error: NextResponse.json({ error: "Alumno no válido" }, { status: 400 }),
    };
  }
  const student = await getManageableStudent(user.id, id);
  if (!student) {
    return {
      error: NextResponse.json(
        { error: "Alumno no encontrado" },
        { status: 404 }
      ),
    };
  }
  return { user, student };
}

export async function GET(_request: Request, context: Context) {
  const auth = await authorize(context);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ data: await listGuardians(auth.student.id) });
}

export async function POST(request: Request, context: Context) {
  const auth = await authorize(context);
  if ("error" in auth) return auth.error;
  if (!auth.student.clubId) {
    return NextResponse.json(
      {
        error:
          "Solo los alumnos de un club pueden tener contactos para mensajes.",
      },
      { status: 400 }
    );
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 400 }
    );
  }
  try {
    await createGuardian(auth.student, parsed.data);
    return NextResponse.json(
      { data: await listGuardians(auth.student.id) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof GuardianError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("[guardians] create failed", error);
    return NextResponse.json(
      { error: "No se pudo añadir el contacto." },
      { status: 500 }
    );
  }
}
