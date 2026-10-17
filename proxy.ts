import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/ayuda",
  "/classes",
  "/exercises",
  "/s/",
  "/animacion/",
  "/privacy",
  "/privacidad",
  "/aviso-legal",
  "/cookies",
  "/terminos",
  "/landing/",
  "/api/cron/",
  "/api/public/sport",
];
const PUBLIC_EXACT = new Set(["/"]);
const RECOVERABLE_REFRESH_TOKEN_ERRORS = new Set([
  "refresh_token_already_used",
  "refresh_token_not_found",
  "invalid_refresh_token",
]);
const isProd = process.env.NODE_ENV === "production";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "form-action 'self'",
    "img-src 'self' data: blob: https://*.supabase.co https://images.pexels.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self'${isProd ? ` 'nonce-${nonce}' 'strict-dynamic'` : " 'unsafe-inline' 'unsafe-eval'"}`,
    "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.pexels.com",
    "media-src 'self' blob: https://*.supabase.co",
    "object-src 'none'",
    "worker-src 'self' blob:",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function withSecurityHeaders(
  response: NextResponse,
  csp: string
): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  if (isProd) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return response;
}

function isRecoverableAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as {
    code?: string;
    name?: string;
    status?: number;
    message?: string;
  };

  if (maybeError.name === "AuthSessionMissingError") return true;

  if (
    typeof maybeError.code === "string" &&
    RECOVERABLE_REFRESH_TOKEN_ERRORS.has(maybeError.code)
  ) {
    return true;
  }

  const message =
    typeof maybeError.message === "string"
      ? maybeError.message.toLowerCase()
      : "";

  if (message.includes("auth session missing")) return true;

  return maybeError.status === 400 && message.includes("refresh token");
}

function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse
) {
  const authCookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.startsWith("sb-"));

  authCookieNames.forEach((name) => {
    request.cookies.delete(name);
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  });
}

function isSameOriginRequest(request: NextRequest): boolean {
  const expected = request.nextUrl.origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expected;

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).origin === expected;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const createResponse = () =>
    withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      csp
    );

  let supabaseResponse = createResponse();
  let shouldClearAuthCookies = false;

  const { pathname } = request.nextUrl;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = createResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // CSRF hardening: for state-changing API requests, require same-origin Origin/Referer.
  const method = request.method.toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (isMutation && pathname.startsWith("/api/")) {
    if (!isSameOriginRequest(request)) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Cross-origin request blocked" },
          { status: 403 }
        ),
        csp
      );
    }
  }

  const authHeader = request.headers.get("authorization");
  const hasBearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ");
  const isExercisesReadApi =
    request.method === "GET" && pathname.startsWith("/api/exercises");
  const isClassesReadApi =
    request.method === "GET" && pathname.startsWith("/api/classes");
  const isProfileBootstrapApi =
    pathname === "/api/users" && request.method === "POST" && hasBearerToken;
  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p)) ||
    isExercisesReadApi ||
    isClassesReadApi ||
    isProfileBootstrapApi;
  const isApiRoute = pathname.startsWith("/api/");
  const shouldCheckUser =
    !isPublic || pathname === "/login" || pathname === "/register";

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] =
    null;
  if (shouldCheckUser) {
    try {
      const {
        data: { user: currentUser },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      user = currentUser;
    } catch (error) {
      if (isRecoverableAuthError(error)) {
        shouldClearAuthCookies = true;
        clearSupabaseAuthCookies(request, supabaseResponse);
      } else {
        console.error("Unexpected Supabase auth error in proxy", error);
      }
    }
  }

  if (!user && !isPublic) {
    if (isApiRoute) {
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
      if (shouldClearAuthCookies) clearSupabaseAuthCookies(request, response);
      return withSecurityHeaders(response, csp);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    if (shouldClearAuthCookies) clearSupabaseAuthCookies(request, response);
    return withSecurityHeaders(response, csp);
  }

  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return withSecurityHeaders(NextResponse.redirect(url), csp);
  }

  return withSecurityHeaders(supabaseResponse, csp);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
