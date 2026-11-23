import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { finishSignIn, safeNext } from "@/lib/auth/finish-sign-in";

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
];

// Enlaces de los correos de Supabase (confirmar cuenta, recuperar contraseña,
// cambiar correo). Se validan en el servidor con el token del enlace, así que
// funcionan aunque se abran en otro navegador o desde la app del correo.
// Las plantillas de correo de Supabase deben apuntar aquí:
//   /auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type = OTP_TYPES.find((t) => t === rawType);

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    const expired =
      error.code === "otp_expired" || error.code === "flow_state_expired";
    if (type === "recovery") {
      return NextResponse.redirect(`${origin}/reset-password?error=expired`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${expired ? "link_expired" : "auth_callback_failed"}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await finishSignIn(
      supabase,
      user,
      (user.user_metadata?.account_type as string | undefined) ?? null
    );
  }

  const fallback = type === "recovery" ? "/reset-password" : "/dashboard";
  return NextResponse.redirect(
    `${origin}${safeNext(searchParams.get("next"), fallback)}`
  );
}
