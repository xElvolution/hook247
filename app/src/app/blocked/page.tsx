import { redirect } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { standing, standingMessage } from "@/lib/moderation";
import { destroySession } from "@/lib/session";

// The standing is read fresh on every visit: a suspension that has lapsed
// should let the account straight back in without an admin touching anything.
export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  // Cookies cannot be written while a page renders, so clearing the session is
  // a Server Action the user triggers rather than a side effect of the render.
  await destroySession();
  redirect("/login");
}

export default async function BlockedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const status = standing(user);
  if (status.ok) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <ShieldOff className="h-8 w-8 text-red-400" />
        </div>

        <h1 className="mt-5 font-display text-2xl font-bold">
          Account {status.kind === "banned" ? "closed" : "suspended"}
        </h1>

        <p className="mt-3 text-muted">{standingMessage(status)}</p>

        <p className="mt-5 text-sm text-muted">
          {status.kind === "suspended"
            ? "You can sign back in once the suspension ends."
            : "If you believe this was a mistake, contact support."}
        </p>

        <form action={signOut} className="mt-6">
          <button type="submit" className="btn-ghost w-full text-sm">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
