import type { Metadata } from "next";
import { Geist, Sora } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hook247 — Dating that never sleeps",
  description:
    "Hook247 is the 24/7 dating platform. Swipe, match, chat and vibe with real, verified people near you.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${sora.variable}`}>
      <body className="noise antialiased">{children}</body>
    </html>
  );
}
