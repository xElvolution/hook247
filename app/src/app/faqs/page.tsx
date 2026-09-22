import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const FAQS = [
  {
    q: "Is Hooks247 free?",
    a: "Yes. Clients browse profiles with no account. Ladies create a profile for free. You only pay if you want a Boost or a paid featured profile.",
  },
  {
    q: "How do I contact someone?",
    a: "Open a profile and tap WhatsApp. There is no match wait. You chat on WhatsApp about availability and rates.",
  },
  {
    q: "What does the blue badge mean?",
    a: "Verified profiles have confirmed they are a real person. Look for the badge before you meet anyone.",
  },
  {
    q: "What is a Boost?",
    a: "A Boost puts your profile at the front of search in your area so more clients see you first.",
  },
  {
    q: "Who can create a profile?",
    a: "Adults 18 and over only. We check age at signup and remove underage accounts immediately.",
  },
  {
    q: "How do I report someone?",
    a: "Use the report option on any profile, or reach us via the Contact page. We review reports quickly.",
  },
];

export default function FaqsPage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4 py-10">
      <div className="orb h-72 w-72 bg-[#ff2d78]/25 -top-20 -right-20 fixed" />
      <Link
        href="/"
        className="mb-8 flex w-fit items-center gap-2 text-sm text-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>
      <h1 className="font-display text-3xl font-extrabold">
        Frequently asked <span className="text-gradient">questions</span>
      </h1>
      <div className="mt-8 space-y-4">
        {FAQS.map((f) => (
          <details key={f.q} className="glass group rounded-2xl p-5">
            <summary className="cursor-pointer list-none font-display font-bold marker:hidden">
              {f.q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
