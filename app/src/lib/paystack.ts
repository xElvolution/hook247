import crypto from "crypto";

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? "";
const PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY ?? "";

if (!SECRET_KEY || !PUBLIC_KEY) {
  // Fail fast in production rather than surfacing an opaque 500 at checkout.
  const message =
    "Paystack keys missing — set PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY.";
  if (process.env.NODE_ENV === "production") throw new Error(message);
  console.warn(`⚠️ ${message}`);
}

export { PUBLIC_KEY as PAYSTACK_PUBLIC_KEY };

const API = "https://api.paystack.co";

type InitResponse = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

/**
 * Start a Paystack checkout. The user is redirected to `authorization_url` to
 * complete payment. Paystack then calls our webhook with the final status.
 */
export async function initializeTransaction(
  email: string,
  amountKobo: number,
  reference: string,
  callbackUrl: string
): Promise<InitResponse> {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountKobo,
      reference,
      callback_url: callbackUrl,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Paystack init failed: ${res.status} ${body}`);
  }
  const json = await res.json();
  return json.data as InitResponse;
}

/**
 * Verify a transaction by reference. Called by our webhook to confirm payment
 * before fulfilling the purchase.
 */
export async function verifyTransaction(reference: string) {
  const res = await fetch(`${API}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${SECRET_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Paystack verify failed: ${res.status} ${body}`);
  }
  const json = await res.json();
  const data = json.data as {
    status: string;
    reference: string;
    amount: number;
    customer: { email: string };
  };
  return {
    success: data.status === "success",
    reference: data.reference,
    amountKobo: data.amount,
    email: data.customer.email,
  };
}

/**
 * Validate the Paystack webhook signature so we only act on genuine events.
 * Every webhook POST carries an `x-paystack-signature` header that is the
 * HMAC-SHA512 of the raw body, keyed by PAYSTACK_SECRET_KEY.
 */
export function verifyWebhookSignature(body: string, signature: string) {
  const hash = crypto.createHmac("sha512", SECRET_KEY).update(body).digest("hex");
  // Constant-time compare so a forged signature can't be discovered by timing
  // the response. timingSafeEqual throws on length mismatch, hence the guard.
  const expected = Buffer.from(hash, "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}
