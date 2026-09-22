import crypto from "crypto";

/**
 * Dojah KYC integration (NIN + selfie liveness).
 *
 * The widget runs client-side keyed by the *public* App ID + public key +
 * widget ID (see NEXT_PUBLIC_DOJAH_* below). The result we actually trust comes
 * from Dojah's signed webhook, verified here — never the browser's onSuccess,
 * exactly as we treat the Paystack callback.
 *
 * Server-side auth uses two headers (no "Bearer"):
 *   Authorization: <secret key>
 *   AppId:         <app id>
 */

const APP_ID = process.env.DOJAH_APP_ID ?? "";
const SECRET_KEY = process.env.DOJAH_SECRET_KEY ?? "";
const WIDGET_ID = process.env.DOJAH_WIDGET_ID ?? "";
const PUBLIC_KEY = process.env.DOJAH_PUBLIC_KEY ?? "";

// Sandbox and live share the same host; the environment is decided by which key
// pair you use (test_/prod_ prefixes). Overridable in case Dojah moves it.
const API = process.env.DOJAH_BASE_URL ?? "https://api.dojah.io";

/** True once the server-side keys needed to verify webhooks are present. */
export const DOJAH_CONFIGURED = Boolean(APP_ID && SECRET_KEY);

if (!DOJAH_CONFIGURED) {
  // Don't hard-fail the whole app the way Paystack does — verification is one
  // feature, not checkout. Warn loudly; the webhook route refuses events until
  // it is configured, so a half-set-up integration can't silently pass anyone.
  console.warn(
    "⚠️ Dojah not configured — set DOJAH_APP_ID and DOJAH_SECRET_KEY to enable ID verification."
  );
}

/**
 * Verify the webhook signature. Every Dojah webhook carries an
 * `x-dojah-signature` header: the HMAC-SHA256 of the raw request body, keyed by
 * the secret key, hex-encoded. Compare in constant time.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!SECRET_KEY || !signature) return false;
  const hash = crypto.createHmac("sha256", SECRET_KEY).update(rawBody).digest("hex");
  const expected = Buffer.from(hash, "utf8");
  const received = Buffer.from(signature, "utf8");
  // timingSafeEqual throws on length mismatch, so guard first.
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

/**
 * Public config the browser needs to launch the widget. All three values are
 * safe to expose — the widget is designed to run with them client-side.
 */
export function publicWidgetConfig() {
  return {
    appId: process.env.NEXT_PUBLIC_DOJAH_APP_ID ?? APP_ID,
    publicKey: process.env.NEXT_PUBLIC_DOJAH_PUBLIC_KEY ?? PUBLIC_KEY,
    widgetId: process.env.NEXT_PUBLIC_DOJAH_WIDGET_ID ?? WIDGET_ID,
  };
}

/** Whether the browser has enough to render the widget. */
export function widgetReady(): boolean {
  const c = publicWidgetConfig();
  // widget_id is only required for a custom EasyOnboard flow. The built-in
  // "verification" type launches with app id + public key alone.
  return Boolean(c.appId && c.publicKey);
}

type DojahEvent = {
  // Dojah has used a few shapes over time; keep this permissive and read
  // defensively in the webhook rather than betting on one exact schema.
  referenceId?: string;
  reference_id?: string;
  verificationId?: string;
  verification_id?: string;
  status?: boolean | string;
  verificationStatus?: string;
  verification_status?: string;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * Pull the pieces we care about out of a webhook event, tolerant of casing and
 * nesting differences: which user it is (from the metadata we sent) and whether
 * the check passed.
 */
export function readEvent(event: DojahEvent): {
  userId: string | null;
  reference: string | null;
  passed: boolean;
} {
  const metadata =
    (event.metadata as Record<string, unknown> | undefined) ??
    ((event.data?.metadata as Record<string, unknown>) || undefined);

  const rawUserId = metadata?.user_id ?? metadata?.userId;
  const userId = typeof rawUserId === "string" ? rawUserId : null;

  const reference =
    event.referenceId ??
    event.reference_id ??
    event.verificationId ??
    event.verification_id ??
    (typeof event.data?.reference_id === "string" ? (event.data.reference_id as string) : null) ??
    null;

  // Accept the several ways Dojah expresses "this passed".
  const statusText = String(
    event.verificationStatus ?? event.verification_status ?? event.status ?? ""
  ).toLowerCase();
  const passed =
    event.status === true ||
    statusText === "true" ||
    statusText === "completed" ||
    statusText === "approved" ||
    statusText === "successful" ||
    statusText === "success" ||
    statusText === "verified";

  return { userId, reference, passed };
}

export const DOJAH_API = API;
