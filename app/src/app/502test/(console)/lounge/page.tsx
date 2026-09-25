import Link from "next/link";
import { db } from "@/lib/db";
import { Panel, Empty } from "@/components/admin/Ui";
import { setLoungeHidden } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoungeAdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  const rows = await db.loungeMessage.findMany({
    where: term ? { body: { contains: term, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { user: { select: { email: true, bannedAt: true, profile: { select: { displayName: true } } } } },
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Lounge</h1>
        <p className="mt-1 text-sm text-muted">Public group chat. Hidden messages disappear for everyone on their next load.</p>
      </div>
      <Panel title="Messages">
        <form className="mb-3 flex gap-2">
          <input name="q" defaultValue={term} placeholder="Search text" className="w-64 rounded border border-line bg-bg px-2 py-1.5 text-sm outline-none focus:border-brand" />
          <button type="submit" className="rounded border border-line px-3 py-1.5 text-xs font-semibold">Search</button>
        </form>
        {rows.length === 0 ? (
          <Empty>No messages.</Empty>
        ) : (
          <ul className="divide-y divide-line/60 text-sm">
            {rows.map((m) => (
              <li key={m.id} className={`flex items-start gap-3 py-2 ${m.hiddenAt ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    <Link href={`/502test/users/${m.userId}`} className="underline">{m.user.profile?.displayName ?? m.user.email}</Link>
                    {m.user.bannedAt ? " · banned" : ""} · {m.createdAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}
                    {m.hiddenAt ? " · hidden" : ""}
                  </p>
                  <p className="mt-0.5 break-words">{m.body}</p>
                </div>
                <form action={setLoungeHidden}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="hide" value={m.hiddenAt ? "0" : "1"} />
                  <button type="submit" className="rounded border border-line px-2 py-1 text-xs font-semibold">{m.hiddenAt ? "Restore" : "Hide"}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
