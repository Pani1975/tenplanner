import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { StudentForm } from "@/components/app/student-form";

type Gender = "male" | "female" | "other";
type DominantHand = "left" | "right";
type PlayerLevel =
  | "beginner"
  | "amateur"
  | "intermediate"
  | "advanced"
  | "competitive"
  | "descubrimiento"
  | "desarrollo"
  | "consolidacion"
  | "especializacion"
  | "precompeticion"
  | "competicion"
  | "adultos_iniciacion"
  | "adultos_medio_alto";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStudentPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.coachId, user.id)))
    .limit(1);

  if (!student) notFound();

  return (
    <div className="w-full px-4 py-8 sm:px-6 md:px-10">
      <div className="mb-6 flex items-start gap-4 border-b border-foreground/10 pb-5">
        <Link
          href={`/students/${student.id}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38] hover:text-[#050505]"
          aria-label="Volver al alumno"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#D6FF38]">
            Ficha de alumno
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Editar alumno
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{student.name}</p>
        </div>
      </div>

      <StudentForm
        mode="edit"
        studentId={student.id}
        initialData={{
          name: student.name,
          email: student.email,
          gender: student.gender as Gender | null,
          birthDate: student.birthDate,
          heightCm: student.heightCm,
          weightKg: student.weightKg,
          dominantHand: student.dominantHand as DominantHand | null,
          playerLevel: student.playerLevel as PlayerLevel | null,
          yearsExperience: student.yearsExperience,
          yearStartedTennis: student.yearStartedTennis,
          yearStartedRacketSports: student.yearStartedRacketSports,
          phone: student.phone,
          preferredSchedule: student.preferredSchedule,
          locality: student.locality,
          notes: student.notes,
          imageUrl: student.imageUrl,
        }}
      />
    </div>
  );
}
