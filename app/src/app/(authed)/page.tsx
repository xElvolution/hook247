import { Suspense } from "react";
import { getCurrentUser } from "@/lib/user";
import HomeBrowse from "@/components/home/HomeBrowse";
import LoadingScreen from "@/components/LoadingScreen";

export default async function AppHome() {
  const user = await getCurrentUser();
  return (
    <Suspense fallback={<LoadingScreen fill={false} label="Loading profiles" />}>
      <HomeBrowse authed={!!user?.profile} />
    </Suspense>
  );
}
