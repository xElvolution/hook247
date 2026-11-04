import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LEGAL_DOCS, LEGAL_LINKS, type LegalDoc } from "@/lib/legal";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav className={`legal-links ${className}`.trim()} aria-label="Legal">
      {LEGAL_LINKS.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="relative mx-auto max-w-2xl px-4 py-10">
      <div className="orb h-72 w-72 bg-[#ff2d78]/20 -top-20 -right-16 fixed" />
      <Link href="/" className="mb-8 flex w-fit items-center gap-2 text-sm text-muted transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>
      <p className="section-kicker">Flirta247</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted">Effective date: {doc.effective}</p>
      <div className="legal-doc mt-6">
        {doc.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets ? (
              <ul>
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.after?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
      <div className="mt-10 border-t border-line pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Other policies</p>
        <ul className="mt-3 space-y-2 text-sm">
          {LEGAL_DOCS.filter((item) => item.href !== doc.href).map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="underline decoration-white/20 underline-offset-4 hover:text-white">
                {item.short}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/contact" className="underline decoration-white/20 underline-offset-4 hover:text-white">
              Contact
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
