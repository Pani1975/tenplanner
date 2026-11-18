import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { redirectIfStudentsLimited } from "@/lib/work-mode";
import { db } from "@/db";
import { students, studentVideos } from "@/db/schema";
import { StudentForm } from "@/components/app/student-form";
import type { HowFound, LeftReason } from "@/lib/students/membership";
import { getTranslations } from "next-intl/server";

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
  const tx = await getTranslations("ui.s_edit_page");
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");
  await redirectIfStudentsLimited(user.id);

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.coachId, user.id)))
    .limit(1);

  if (!student) notFound();

  // Si la tabla aún no existe (migración 0098), el formulario se muestra igual.
  const videos = await db
    .select({
      id: studentVideos.id,
      location: studentVideos.location,
      event: studentVideos.event,
      recordedOn: studentVideos.recordedOn,
      notes: studentVideos.notes,
      videoUrl: studentVideos.videoUrl,
    })
    .from(studentVideos)
    .where(eq(studentVideos.studentId, student.id))
    .orderBy(desc(studentVideos.recordedOn), desc(studentVideos.createdAt))
    .catch((error) => {
      console.error("[student edit] videos failed", error);
      return null;
    });

  return (
    <div className="w-full px-4 py-8 sm:px-6 md:px-10">
      <div className="mb-6 flex items-start gap-4 border-b border-foreground/10 pb-5">
        <Link
          href={`/students/${student.id}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38] hover:text-[#050505]"
          aria-label={tx("volverAlAlumno")}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#D6FF38]">
            {tx("fichaDeAlumno")}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {tx("editarAlumno")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{student.name}</p>
        </div>
      </div>

      <StudentForm
        mode="edit"
        studentId={student.id}
        studentName={student.name}
        videos={videos}
        initialData={{
          name: student.name,
          firstName: student.firstName,
          lastName: student.lastName,
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
          joinedAt: student.joinedAt,
          howFound: student.howFound as HowFound | null,
          howFoundDetail: student.howFoundDetail,
          leftAt: student.leftAt,
          leftReason: student.leftReason as LeftReason | null,
          leftReasonDetail: student.leftReasonDetail,
          notes: student.notes,
          imageUrl: student.imageUrl,
        }}
      />
    </div>
  );
}
