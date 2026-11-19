import localFont from "next/font/local";

// DM Sans (licencia OFL, de @fontsource-variable/dm-sans), solo para las
// pantallas de torneos: texto en DM Sans y títulos en Fraunces, color
// principal verde lima #d6f04a (antes azul) (decisión de David, 2026-11-19). Ver .tp-torneos
// en globals.css.
export const dmSans = localFont({
  src: "./dm-sans-latin-wght-normal.woff2",
  variable: "--font-dm-sans",
  weight: "100 1000",
  display: "swap",
});
