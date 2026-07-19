import { getCurrentUser } from "@/lib/user";
import HomeBrowse from "@/components/home/HomeBrowse";

export default async function AppHome() {
  const user = await getCurrentUser();
  return <HomeBrowse authed={!!user?.profile} />;
}
