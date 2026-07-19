import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const FAQS = [
  {
    q: "Is Hook247 free?",
    a: "Yes — joining, swiping, matching and chatting are free. Premium (Plus/Elite) adds extras like seeing who liked you, unlimited likes and profile Boosts.",
  },
  {
    q: "How does matching work?",
    a: "When you like someone and they like you back, it's a match — chat opens instantly for both of you. Nobody can message you without a mutual match.",
  },
  {
    q: "What does the blue badge mean?",
    a: "Verified members have confirmed they're a real person. Look for the badge before you meet anyone.",
  },
  {
    q: "What is a Boost?",
    a: "A Boost puts your profile at the front of everyone's deck nearby, so you get seen (and liked) much faster. Available on Plus and Elite plans.",
  },
  {
    q: "Who can join?",
    a: "Adults 18 and over only. We verify age at signup and remove underage accounts immediately.",
  },
  {
    q: "How do I report someone?",
    a: "Use the report option on any profile or message, or reach us via the Contact page. We review reports quickly and remove bad actors.",
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
