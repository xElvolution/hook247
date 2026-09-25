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

async function paystackGet<T>(pathname: string): Promise<T> {
  const res = await fetch(`${API}${pathname}`, {
    headers: { Authorization: `Bearer ${SECRET_KEY}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status) {
    throw new PaystackError(json?.message ?? `Paystack request failed (${res.status})`, res.status);
  }
  return json.data as T;
}

async function paystackPost<T>(pathname: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status) {
    throw new PaystackError(json?.message ?? `Paystack request failed (${res.status})`, res.status);
  }
  return json.data as T;
}

export class PaystackError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Like verifyTransaction, but keeps Paystack's own status so callers can tell
 * a payment that failed from one that is simply not finished yet.
 */
export async function verifyTransactionStatus(reference: string) {
  const data = await paystackGet<{
    status: string;
    reference: string;
    amount: number;
    currency: string;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return { status: data.status, amountKobo: data.amount, currency: data.currency, reference: data.reference };
}

export type Bank = { name: string; code: string };

let bankCache: { at: number; banks: Bank[] } | null = null;

/** Nigerian banks that can receive NUBAN transfers, cached for 12 hours. */
export async function listBanks(): Promise<Bank[]> {
  if (bankCache && Date.now() - bankCache.at < 12 * 60 * 60 * 1000) return bankCache.banks;
  const data = await paystackGet<{ name: string; code: string; active: boolean; type: string }[]>(
    "/bank?country=nigeria&perPage=200&use_cursor=false"
  );
  const seen = new Set<string>();
  const banks = data
    .filter((b) => b.active && b.type === "nuban" && !seen.has(b.code) && seen.add(b.code))
    .map((b) => ({ name: b.name, code: b.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
  bankCache = { at: Date.now(), banks };
  return banks;
}

/** Look up the account holder's name for a bank account number. */
export async function resolveAccount(accountNumber: string, bankCode: string) {
  const data = await paystackGet<{ account_name: string; account_number: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  );
  return { accountName: data.account_name, accountNumber: data.account_number };
}

export async function createTransferRecipient(input: {
  name: string;
  accountNumber: string;
  bankCode: string;
}) {
  const data = await paystackPost<{ recipient_code: string }>("/transferrecipient", {
    type: "nuban",
    name: input.name,
    account_number: input.accountNumber,
    bank_code: input.bankCode,
    currency: "NGN",
  });
  return data.recipient_code;
}

export async function initiateTransfer(input: {
  amountKobo: number;
  recipientCode: string;
  reference: string;
  reason: string;
}) {
  const data = await paystackPost<{ status: string; transfer_code: string; reference: string }>("/transfer", {
    source: "balance",
    amount: input.amountKobo,
    recipient: input.recipientCode,
    reference: input.reference,
    reason: input.reason,
  });
  return { status: data.status, transferCode: data.transfer_code, reference: data.reference };
}
