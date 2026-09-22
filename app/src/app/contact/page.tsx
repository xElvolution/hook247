import Link from "next/link";
import { ArrowLeft, Mail, Flag, ShieldCheck } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="relative mx-auto max-w-2xl px-4 py-10">
      <div className="orb h-72 w-72 bg-[#7c3aed]/25 -top-20 -left-20 fixed" />
      <Link
        href="/"
        className="mb-8 flex w-fit items-center gap-2 text-sm text-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>
      <h1 className="font-display text-3xl font-extrabold">
        Get in <span className="text-gradient">touch</span>
      </h1>
      <p className="mt-3 text-muted">
        Questions, feedback or something to report. We read everything.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <a
          href="mailto:support@hook247.app"
          className="glass rounded-3xl p-6 transition hover:border-white/25"
        >
          <Mail className="h-6 w-6 text-[#ff5d52]" />
          <h2 className="font-display mt-3 font-bold">Support</h2>
          <p className="mt-1 text-sm text-muted">support@hook247.app</p>
        </a>
        <a
          href="mailto:safety@hook247.app"
          className="glass rounded-3xl p-6 transition hover:border-white/25"
        >
          <Flag className="h-6 w-6 text-[#ff5d52]" />
          <h2 className="font-display mt-3 font-bold">Report a profile</h2>
          <p className="mt-1 text-sm text-muted">safety@hook247.app</p>
        </a>
      </div>

      <div className="glass mt-4 flex items-start gap-3 rounded-3xl p-6">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <p className="text-sm text-muted">
          Safety reports are prioritised and reviewed within 24 hours. If you
          are in immediate danger, contact local emergency services first.
        </p>
      </div>
    </div>
  );
}
