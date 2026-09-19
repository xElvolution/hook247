import { redirect } from "next/navigation";
import PremiumPlans from "@/components/PremiumPlans";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { fulfilPayment } from "@/lib/fulfilPayment";
import { publicWidgetConfig } from "@/lib/dojah";
import { isMockUserId, mockCurrentUser } from "@/lib/mock";

export const metadata = { title: "Premium | Hook247" };

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/premium");

  const params = await searchParams;
  const reference =
    typeof params.reference === "string" ? params.reference : "";

  // Paystack redirects here after checkout. Completing the purchase from the
  // callback too means it activates even when the webhook cannot reach us
  // (local development, or a webhook outage). fulfilPayment is idempotent, so
  // whichever path arrives second is a no-op.
  let justPaid = false;
  if (params.status === "success" && reference) {
    try {
      const result = await fulfilPayment(reference);
      justPaid = result.ok;
    } catch (err) {
      console.error("Callback fulfilment failed:", err);
    }
  }

  if (isMockUserId(userId)) {
    const mock = mockCurrentUser().profile;
    return (
      <PremiumPlans
        userId={userId}
        currentPlan={mock.plan}
        verified={mock.verified}
        paymentPending={false}
        paymentComplete={false}
        dojah={publicWidgetConfig()}
      />
    );
  }

  // Read the profile after fulfilment so the page shows the upgraded plan.
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { plan: true, verified: true },
  });
  if (!profile) redirect("/onboarding");

  return (
    <PremiumPlans
      userId={userId}
      currentPlan={profile.plan}
      verified={profile.verified}
      paymentPending={params.status === "success" && !justPaid}
      paymentComplete={justPaid}
      dojah={publicWidgetConfig()}
    />
  );
}
