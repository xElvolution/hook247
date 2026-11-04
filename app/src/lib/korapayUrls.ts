import { KORAPAY_WEBHOOK_PATH } from "./korapay";
import { requestAppUrl } from "./publicUrl";

/**
 * Webhook URL sent with each checkout as `notification_url`. Built from the
 * host the buyer is using (like the redirect URL), so it always reaches this
 * deployment. KORAPAY_NOTIFICATION_URL overrides it when set.
 */
export function korapayNotificationUrl(req: Request) {
  const override = (process.env.KORAPAY_NOTIFICATION_URL ?? "").trim();
  if (override) return override;
  const origin = requestAppUrl(req);
  // Korapay cannot reach a local dev server; let the dashboard URL apply.
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(origin)) return undefined;
  return `${origin}${KORAPAY_WEBHOOK_PATH}`;
}
