import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { PAYMENTS } from "@/lib/legal";

export const metadata: Metadata = { title: "Payments, Refunds & Virtual Credits | Flirta247" };

export default function PaymentsPolicyPage() {
  return <LegalPage doc={PAYMENTS} />;
}
