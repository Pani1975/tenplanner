import { redirect } from "next/navigation";
import { dmSans } from "@/app/fonts/dm-sans";
import { createClient } from "@/lib/supabase/server";
import { GuestProvider } from "./guest-client";

// Torneos de prueba, sin registro. Con sesión iniciada, a los de la cuenta.
export default async function ProbarTorneosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/torneos");
  return (
    <div className={`${dmSans.variable} tp-torneos tp-page`}>
      <GuestProvider>{children}</GuestProvider>
    </div>
  );
}
