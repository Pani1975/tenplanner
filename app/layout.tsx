import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { CookieBanner } from "@/components/app/cookie-banner";
import { ServiceWorkerRegister } from "@/components/app/sw-register";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://tenplanner.app";
const isProd = process.env.NODE_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TenPlanner - Planificador para Deportes de Raqueta",
    template: "%s - TenPlanner",
  },
  description:
    "Planifica sesiones, gestiona alumnos y organiza biblioteca para deportes de raqueta.",
  keywords: [
    "deportes de raqueta",
    "entrenamiento",
    "planificador",
    "entrenador",
    "sesiones",
    "TenPlanner",
  ],
  applicationName: "TenPlanner",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "TenPlanner",
    title: "TenPlanner - Planificador para Deportes de Raqueta",
    description:
      "Diseña sesiones, gestiona alumnos y mide progreso en pista o cancha.",
    url: "/",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenPlanner",
    description: "Planificador de entrenamiento para deportes de raqueta.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TenPlanner",
  },
};

export const viewport = {
  themeColor: "#050505",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const scriptNonce = isProd ? nonce : undefined;

  return (
    <html
      lang="es"
      className={`${plusJakartaSans.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-brand focus:outline-none"
        >
          Ir al contenido principal
        </a>
        <Script
          id="theme-init"
          nonce={scriptNonce}
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
          try {
            var autoTheme = localStorage.getItem('theme-auto') !== 'false';
            var h = new Date().getHours();
            var timeDark = h < 7 || h >= 21;
            var t = localStorage.getItem('theme');
            var isDark = autoTheme ? timeDark : (t ? t === 'dark' : timeDark);
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            document.documentElement.classList.toggle('dark', isDark);
            var A = { blue: { dark: '#d6ff38', light: '#d6ff38', mutedDark: '#2b3613', mutedLight: '#efffba' }, green: { dark: '#5cff8d', light: '#5cff8d', mutedDark: '#14361f', mutedLight: '#dcffe5' }, violet: { dark: '#6ee7ff', light: '#6ee7ff', mutedDark: '#10313a', mutedLight: '#dff8ff' }, amber: { dark: '#ffd166', light: '#ffd166', mutedDark: '#3d2d12', mutedLight: '#fff2c7' }, rose: { dark: '#ff7a66', light: '#ff7a66', mutedDark: '#3d1f1a', mutedLight: '#ffe2dc' } };
            var ac = localStorage.getItem('accent') || 'blue';
            var c = A[ac] || A.blue;
            var v = isDark ? c.dark : c.light;
            var muted = isDark ? c.mutedDark : c.mutedLight;
            var el = document.documentElement;
            el.style.setProperty('--brand', v); el.style.setProperty('--brand-muted', muted || v); el.style.setProperty('--brand-foreground', '#050505'); el.style.setProperty('--primary', v); el.style.setProperty('--primary-foreground', '#050505'); el.style.setProperty('--ring', v); el.style.setProperty('--sidebar-primary', v); el.style.setProperty('--sidebar-primary-foreground', '#050505'); el.style.setProperty('--sidebar-ring', v);
            var fs = localStorage.getItem('font-size') || 'md';
            var fm = { sm: '13px', md: '15px', lg: '17px' };
            el.style.fontSize = fm[fs] || '15px';
          } catch(e) {}
        `,
          }}
        />
        {children}
        <CookieBanner />
        <Toaster />
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
