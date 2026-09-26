import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { standing } from "@/lib/moderation";
import Shell from "@/components/Shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // A ban or suspension applied after sign-in has to take effect without
  // waiting for the 30-day session cookie to lapse, so it is checked on every
  // authed render rather than only at login.
  if (user && !standing(user).ok) redirect("/blocked");
  // Signed-in users must finish onboarding; guests may browse everything.
  if (user && !user.profile) redirect("/onboarding");

  return (
    <Shell authed={!!user?.profile} avatarUrl={user?.profile?.avatarUrl ?? ""}>
      {children}
    </Shell>
  );
}
