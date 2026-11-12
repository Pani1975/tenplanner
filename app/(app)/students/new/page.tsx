import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectIfStudentsLimited } from "@/lib/work-mode";
import { StudentForm } from "@/components/app/student-form";

export default async function NewStudentPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");
  await redirectIfStudentsLimited(user.id);

  return (
    <div className="w-full px-4 py-8 sm:px-6 md:px-10">
      <div className="mb-6 flex items-start gap-4 border-b border-foreground/10 pb-5">
        <Link
          href="/students"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38] hover:text-[#050505]"
          aria-label="Volver a alumnos"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#D6FF38]">
            Ficha de alumno
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Nuevo alumno
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Registra un nuevo alumno en tu cartera
          </p>
        </div>
      </div>

      <StudentForm mode="create" />
    </div>
  );
}
