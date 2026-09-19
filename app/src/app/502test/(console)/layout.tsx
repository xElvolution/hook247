import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminSession";
import { db } from "@/lib/db";
import { ReportStatus } from "@prisma/client";
import { leaveAction } from "../enter/actions";

export const metadata: Metadata = {
  title: "502 Bad Gateway",
  robots: { index: false, follow: false },
};

// Counts change with moderation activity, so never serve this shell from cache.
export const dynamic = "force-dynamic";

const TABS = [
  { href: "/502test", label: "Overview" },
  { href: "/502test/users", label: "Users" },
  { href: "/502test/reports", label: "Reports" },
  { href: "/502test/content", label: "Content" },
  { href: "/502test/payments", label: "Payments" },
  { href: "/502test/verification", label: "Verification" },
  { href: "/502test/audit", label: "Audit" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The proxy already turned away anyone without a valid cookie. This second
  // check is the one that actually protects the data: Next's docs warn that a
  // matcher change can silently drop proxy coverage from a route.
  if (!(await isAdmin())) redirect("/");

  // The error boundary in this segment can't catch a throw from the layout
  // itself, so a transient pooler drop here would 500 the whole console. The
  // badge is cosmetic — fall back to hiding it rather than taking down the shell.
  let openReports = 0;
  try {
    openReports = await db.report.count({
      where: { status: ReportStatus.OPEN },
    });
  } catch (err) {
    console.error("[502test] open-reports count failed:", err);
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="glass sticky top-0 z-50 border-b border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <span className="font-display text-lg font-bold">
            Hook<span className="text-brand">247</span>
            <span className="ml-2 rounded bg-brand/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-2">
              Ops
            </span>
          </span>

          <nav className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-ink"
              >
                {t.label}
                {t.href === "/502test/reports" && openReports > 0 ? (
                  <span className="ml-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {openReports}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <form action={leaveAction} className="ml-auto">
            <button
              type="submit"
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
