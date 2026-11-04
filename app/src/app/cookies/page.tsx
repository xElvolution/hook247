import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { COOKIES } from "@/lib/legal";

export const metadata: Metadata = { title: "Cookie & Tracking Policy | Flirta247" };

export default function CookiesPage() {
  return <LegalPage doc={COOKIES} />;
}
