import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { GUIDELINES } from "@/lib/legal";

export const metadata: Metadata = { title: "Community & Safety Guidelines | Flirta247" };

export default function GuidelinesPage() {
  return <LegalPage doc={GUIDELINES} />;
}
