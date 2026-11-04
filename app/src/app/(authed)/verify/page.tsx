import { redirect } from "next/navigation";
import FaceVerify from "@/components/FaceVerify";
import { getSessionUserId } from "@/lib/session";
import { faceStatus } from "@/lib/faceVerify";

export const metadata = { title: "Face verification | Flirta247" };
export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/verify");
  const status = await faceStatus(userId).catch(() => ({
    verified: false,
    state: "PENDING" as const,
    hasReference: false,
    referencePublic: false,
    lastError: "",
    attemptsLeft: 0,
  }));
  return <FaceVerify initial={status as Parameters<typeof FaceVerify>[0]["initial"]} />;
}
