import { redirect } from "next/navigation";
import PremiumPlans from "@/components/PremiumPlans";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { fulfilPayment } from "@/lib/fulfilPayment";
import { publicWidgetConfig } from "@/lib/dojah";
import { isMockUserId, mockCurrentUser } from "@/lib/mock";

export const metadata = { title: "Premium | Hooks247" };

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/premium");

  const params = await searchParams;
  const reference = firstParam(params.reference) || firstParam(params.trxref);
  const paidReturn = Boolean(reference) || firstParam(params.status) === "success";

  let justPaid = false;
  if (reference) {
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
        subscriptionLabel=""
        dojah={publicWidgetConfig()}
      />
    );
  }

  try {
    const profile = await db.profile.findUnique({
      where: { userId },
      select: { plan: true, verified: true, subscriptionExpiresAt: true, subscriptionPlanSlug: true },
    });
    if (!profile) redirect("/onboarding");

    const active = profile.subscriptionExpiresAt && profile.subscriptionExpiresAt > new Date();
    const until = profile.subscriptionExpiresAt
      ? profile.subscriptionExpiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "";
    const subscriptionLabel = active
      ? `Live until ${until}.`
      : "Your profile is hidden until a plan is active.";

    return (
      <PremiumPlans
        userId={userId}
        currentPlan={profile.plan}
        verified={profile.verified}
        paymentPending={paidReturn && !justPaid}
        paymentComplete={justPaid || Boolean(active && paidReturn)}
        subscriptionLabel={subscriptionLabel}
        dojah={publicWidgetConfig()}
      />
    );
  } catch (err) {
    console.error("Premium page failed:", err);
    return (
      <PremiumPlans
        userId={userId}
        currentPlan="FREE"
        verified={false}
        paymentPending={paidReturn && !justPaid}
        paymentComplete={justPaid}
        subscriptionLabel={justPaid ? "Payment received. Your profile is updating." : "Pay to activate your profile."}
        dojah={publicWidgetConfig()}
      />
    );
  }
}
