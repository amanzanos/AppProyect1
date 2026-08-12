import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";

// Everything is a client-side party game behind a room code; there is nothing
// worth prerendering at build time.
export const dynamic = "force-dynamic";

const heading = Baloo_2({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blopy — minijuegos rápidos",
  description:
    "Ocho minijuegos de un dedo: topos, Simón, dardos y más. Partidas de un minuto, y modo fiesta en la tele para hasta 8 móviles.",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Blopy" },
};

export const viewport: Viewport = {
  themeColor: "#1b1040",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // The games are played on a phone held sideways and shaken; the browser's
  // pull-to-refresh and rubber-banding get in the way of both.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${heading.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#1b1040] text-white">{children}</body>
    </html>
  );
}
