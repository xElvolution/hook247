import { db } from "@/lib/db";
import { nairaFromKobo } from "@/lib/money";
import { Panel } from "@/components/admin/Ui";
import { setWithdrawal } from "./actions";

export const dynamic = "force-dynamic";

export default async function WithdrawalsPage() {
  const rows = await db.withdrawal.findMany({
    include: { user: { select: { email: true, profile: { select: { displayName: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Withdrawals</h1>
      <Panel title="Requests">
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-2">User</th>
                <th>Amount</th>
                <th>Requested</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-2">
                    {row.user.profile?.displayName || row.user.email}
                    <div className="text-xs text-muted">{row.accountName} · {row.accountNumber} · {row.bankName}</div>
                  </td>
                  <td>{nairaFromKobo(row.amountKobo)}</td>
                  <td>{row.createdAt.toLocaleString()}</td>
                  <td>{row.status}</td>
                  <td>
                    <form action={setWithdrawal} className="flex flex-wrap gap-1">
                      <input type="hidden" name="id" value={row.id} />
                      <input className="input !py-1" name="adminNote" placeholder="Note" defaultValue={row.adminNote} />
                      <button name="status" value="APPROVED" className="rounded border border-line px-2 py-1 text-xs">Approve</button>
                      <button name="status" value="REJECTED" className="rounded border border-line px-2 py-1 text-xs">Reject</button>
                      <button name="status" value="PAID" className="rounded border border-line px-2 py-1 text-xs">Paid</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
