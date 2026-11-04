import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service | Flirta247" };

export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
