import type { Metadata, Viewport } from "next";
import { Geist, Sora } from "next/font/google";
import "./globals.css";
import "./features.css";
import AgeGate from "@/components/AgeGate";
import { PwaRegister } from "@/components/PwaInstall";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hooks247",
  description:
    "Escort and client profiles, 24/7. Search by country and area, view photos and rates, then WhatsApp.",
  applicationName: "Hooks247",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Hooks247",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#121214",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${sora.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="noise antialiased">
        {children}
        <AgeGate />
        <PwaRegister />
      </body>
    </html>
  );
}
