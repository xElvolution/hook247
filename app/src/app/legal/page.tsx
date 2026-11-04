import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LEGAL_DOCS, LEGAL_EFFECTIVE } from "@/lib/legal";

export const metadata: Metadata = { title: "Legal | Flirta247" };

export default function LegalIndexPage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4 py-10">
      <div className="orb h-72 w-72 bg-[#7c3aed]/20 -top-20 -left-16 fixed" />
      <Link href="/" className="mb-8 flex w-fit items-center gap-2 text-sm text-muted transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>
      <p className="section-kicker">Flirta247</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">Legal</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        These policies apply to the Flirta247 website, applications and services. Effective date: {LEGAL_EFFECTIVE}.
      </p>
      <ul className="mt-8 space-y-3">
        {LEGAL_DOCS.map((doc) => (
          <li key={doc.href}>
            <Link href={doc.href} className="glass block rounded-2xl p-5 transition hover:border-white/25">
              <strong className="font-display">{doc.title}</strong>
              <p className="mt-1 text-sm text-muted">{doc.intro[0]}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
