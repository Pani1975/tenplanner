import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finishSignIn, safeNext } from "@/lib/auth/finish-sign-in";

// Vuelta de Google y de los enlaces de correo antiguos (?code=…). Los enlaces
// de correo nuevos llegan a /auth/confirm, que funciona en cualquier navegador.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  // Alta con Google como familia o jugador (viene de /register).
  const requestedAccountType = searchParams.get("account_type");

  // Supabase devuelve ?error_code=otp_expired cuando el enlace ha caducado o
  // ya se usó.
  if (searchParams.get("error_code") === "otp_expired") {
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        if (!user.email) {
          return NextResponse.redirect(`${origin}/login?error=missing_email`);
        }
        await finishSignIn(supabase, user, requestedAccountType);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    // El enlace del correo se abrió en otro navegador o en la app del correo:
    // Supabase ya confirmó el correo, pero aquí no se puede abrir la sesión.
    if (error.code === "pkce_code_verifier_not_found") {
      return NextResponse.redirect(`${origin}/login?error=other_browser`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
