/**
 * Dojah is now used ONLY for the SMS one-time code in phone verification.
 * The old NIN / BVN identity widget and its webhook were removed; identity is
 * proven with the in-app face check instead (see lib/faceVerify.ts).
 *
 * Server-side auth uses two headers (no "Bearer"):
 *   Authorization: <secret key>
 *   AppId:         <app id>
 */

const APP_ID = process.env.DOJAH_APP_ID ?? "";
const SECRET_KEY = process.env.DOJAH_SECRET_KEY ?? "";
const API = process.env.DOJAH_BASE_URL ?? "https://api.dojah.io";

/** True once the server-side keys needed for SMS codes are present. */
export const DOJAH_CONFIGURED = Boolean(APP_ID && SECRET_KEY);

if (!DOJAH_CONFIGURED) {
  console.warn("⚠️ Dojah not configured — set DOJAH_APP_ID and DOJAH_SECRET_KEY to enable SMS phone codes.");
}

export const DOJAH_API = API;

type DojahJson = { entity?: Record<string, unknown>; data?: Record<string, unknown>; message?: string; error?: string };

async function dojahPost(pathname: string, body: unknown): Promise<DojahJson> {
  if (!DOJAH_CONFIGURED) throw new Error("Identity verification is not configured.");
  const res = await fetch(`${API}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: SECRET_KEY,
      AppId: APP_ID,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as DojahJson | null;
  if (!res.ok) {
    throw new Error(json?.message || json?.error || "Phone verification could not be sent.");
  }
  return json ?? {};
}

/** Send an SMS one-time code. Returns Dojah's reference. The code itself is never stored here. */
export async function sendPhoneOtp(destination: string) {
  const json = await dojahPost("/api/v1/messaging/otp", {
    destination,
    channel: "sms",
    sender_id: process.env.DOJAH_SMS_SENDER || "Dojah",
    expiry: 10,
  });
  const data = json.entity ?? json.data ?? {};
  const reference = String(data.reference_id ?? data.referenceId ?? "");
  if (!reference) throw new Error("Phone verification did not return a reference.");
  return reference;
}

/** True when Dojah accepts the code for that reference. */
export async function confirmPhoneOtp(reference: string, code: string) {
  const json = await dojahPost("/api/v1/messaging/otp/validate", {
    reference_id: reference,
    code,
  });
  const data = json.entity ?? json.data ?? {};
  const status = String(data.status ?? data.valid ?? "").toLowerCase();
  if (status === "false" || status === "failed" || data.valid === false || data.status === false) return false;
  return true;
}
