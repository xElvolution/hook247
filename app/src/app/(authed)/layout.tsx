import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import Shell from "@/components/Shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  // Signed-in users must finish onboarding; guests may browse everything.
  if (user && !user.profile) redirect("/onboarding");

  return <Shell authed={!!user?.profile}>{children}</Shell>;
}
