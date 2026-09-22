import type { Metadata } from "next";
import { Geist, Sora } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hooks247",
  description:
    "Independent models, 24/7. Search by area, view photos and rates, then WhatsApp. Beauty may catch your eye. Personality keeps you here.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
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
