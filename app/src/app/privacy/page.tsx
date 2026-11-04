import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy | Flirta247" };

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY} />;
}
