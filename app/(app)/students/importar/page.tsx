import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClubAccountClubId } from "@/lib/clubs";
import { redirectIfStudentsLimited } from "@/lib/work-mode";
import { StudentImport } from "@/components/app/students/student-import";

export const metadata = { title: "Importar alumnos" };
export const dynamic = "force-dynamic";

// Importar el listado de alumnos de un Excel o CSV. Solo el gestor del club
// (la cuenta del club): pensado para una academia que llega con su listado.
export default async function ImportStudentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await getClubAccountClubId(user.id))) notFound();
  await redirectIfStudentsLimited(user.id);

  return (
    <div className="tp-page">
      <div className="tp-page-pad mx-auto max-w-4xl space-y-6">
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Alumnos
        </Link>
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <FileSpreadsheet className="size-3.5" />
            Modo gestión
          </p>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Importar alumnos
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            Da de alta de una vez el listado de alumnos de la academia desde un
            Excel o CSV, sin meterlos uno a uno.
          </p>
        </header>
        <StudentImport />
      </div>
    </div>
  );
}
