import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminSession";
import { db } from "@/lib/db";
import { ReportStatus } from "@prisma/client";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "502 Bad Gateway",
  robots: { index: false, follow: false },
};

// Counts change with moderation activity, so never serve this shell from cache.
export const dynamic = "force-dynamic";

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
  let pendingWithdrawals = 0;
  let pendingCoinPayouts = 0;
  try {
    [openReports, pendingWithdrawals, pendingCoinPayouts] = await Promise.all([
      db.report.count({ where: { status: ReportStatus.OPEN } }),
      db.withdrawal.count({ where: { status: "REQUESTED" } }),
      db.coinWithdrawal.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
    ]);
  } catch (err) {
    console.error("[502test] badge counts failed:", err);
  }

  return (
    <AdminShell badges={{ reports: openReports, withdrawals: pendingWithdrawals, coinPayouts: pendingCoinPayouts }}>
      {children}
    </AdminShell>
  );
}
