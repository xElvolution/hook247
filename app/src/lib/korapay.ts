import crypto from "crypto";

/**
 * Korapay (Kora) API client: Checkout Redirect for pay-ins, bank payouts, bank
 * list / account resolve, balances and webhook signature checks.
 *
 * Units: the app stores money in kobo. Korapay works in naira (the major
 * unit): charges take a whole-naira integer, payouts take naira with two
 * decimals, and every amount Korapay returns is in naira (often as a string
 * like "2000.00"). Convert only at this boundary.
 *
 * Keys: the SECRET key authorises charges, verification, payouts and
 * balances, and signs webhooks. The bank list endpoint only accepts the
 * PUBLIC key. Neither key is ever sent to the browser.
 *
 * Docs: https://developers.korapay.com/docs
 */

const API = "https://api.korapay.com/merchant/api/v1";
export const KORAPAY_CURRENCY = "NGN";
/** Korapay rejects charge references longer than this. */
export const KORAPAY_REFERENCE_MAX = 50;
const TIMEOUT_MS = 20_000;

/**
 * Unique checkout reference that fits Korapay's 50-character cap.
 * `hook247_<plan>_<uuid>` was 52+ characters and Korapay refused the charge.
 */
export function newChargeReference(prefix: string) {
  const stem = prefix.endsWith("_") ? prefix : `${prefix}_`;
  const reference = `${stem}${crypto.randomUUID().replace(/-/g, "")}`;
  if (reference.length > KORAPAY_REFERENCE_MAX) {
    throw new KorapayError(
      `Payment reference is too long for Korapay (${reference.length} > ${KORAPAY_REFERENCE_MAX})`,
      400,
      "reference"
    );
  }
  return reference;
}

function secretKey() {
  return process.env.KORAPAY_SECRET_KEY ?? "";
}
function publicKey() {
  return process.env.KORAPAY_PUBLIC_KEY ?? "";
}

if (!secretKey() || !publicKey()) {
  const message = "Korapay keys missing: set KORAPAY_SECRET_KEY and KORAPAY_PUBLIC_KEY.";
  // Fail fast when the production server boots rather than at checkout, but
  // let `next build` (which also runs with NODE_ENV=production) get through.
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error(message);
  }
  console.warn(`⚠️ ${message}`);
}

export class KorapayError extends Error {
  constructor(
    message: string,
    /** HTTP status from Korapay, or 0 when the request never got an answer. */
    public status: number,
    public code = ""
  ) {
    super(message);
    this.name = "KorapayError";
  }

  /**
   * True when Korapay definitely rejected the request (validation, auth, not
   * found), so nothing was created on their side. Timeouts, network errors,
   * 409 conflicts, rate limits and 5xx are NOT definitive: per Korapay's
   * guidance the transaction may still have gone through and must be looked
   * up before it is treated as failed.
   */
  get definitive() {
    return this.status >= 400 && this.status < 500 && ![408, 409, 425, 429].includes(this.status);
  }
}

type Envelope<T> = { status?: boolean; message?: string; error?: string; code?: string; data?: T };

/** Korapay validation errors carry per-field messages in `data`. */
function describeError(json: Envelope<unknown> | null, httpStatus: number) {
  const base = json?.message || json?.error || `Korapay request failed (HTTP ${httpStatus})`;
  const data = json?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const fields = Object.entries(data as Record<string, unknown>)
      .map(([field, value]) => {
        if (value && typeof value === "object") {
          const v = value as { customErrorMessage?: unknown; message?: unknown };
          const text = v.customErrorMessage ?? v.message;
          return typeof text === "string" ? `${field}: ${text}` : "";
        }
        return "";
      })
      .filter(Boolean);
    if (fields.length) return `${base} (${fields.join("; ")})`;
  }
  return base;
}

async function korapay<T>(
  method: "GET" | "POST",
  pathname: string,
  options: { body?: unknown; key?: "secret" | "public" } = {}
): Promise<T> {
  const key = options.key === "public" ? publicKey() : secretKey();
  if (!key) {
    throw new KorapayError(
      `Korapay is not configured (${options.key === "public" ? "KORAPAY_PUBLIC_KEY" : "KORAPAY_SECRET_KEY"} missing)`,
      0,
      "not_configured"
    );
  }
  let res: Response;
  try {
    res = await fetch(`${API}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = (err as Error)?.name === "TimeoutError" ? "timed out" : "could not be reached";
    throw new KorapayError(`Korapay ${reason}`, 0, "network");
  }
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json || json.status !== true) {
    // A 2xx without a JSON envelope is not a definitive answer either.
    const status = res.ok ? 502 : res.status;
    throw new KorapayError(describeError(json, res.status), status, json?.code ?? json?.error ?? "");
  }
  return json.data as T;
}

// ---------------------------------------------------------------- amounts

/** Kobo to a whole-naira integer for the charge endpoint. */
function koboToWholeNaira(kobo: number) {
  if (!Number.isInteger(kobo) || kobo <= 0) throw new KorapayError("Amount must be a positive whole number of kobo", 400, "amount");
  if (kobo % 100 !== 0) {
    throw new KorapayError("Korapay checkout only accepts whole naira amounts", 400, "amount");
  }
  return kobo / 100;
}

/** Kobo to naira with two decimals for the payout endpoint. */
function koboToNaira2dp(kobo: number) {
  if (!Number.isInteger(kobo) || kobo <= 0) throw new KorapayError("Amount must be a positive whole number of kobo", 400, "amount");
  return Number((kobo / 100).toFixed(2));
}

/** Korapay amounts arrive as numbers or strings ("2000.00"). Null if absent. */
export function nairaToKobo(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

// ---------------------------------------------------------------- pay-ins

/**
 * Start a Checkout Redirect charge. The buyer is sent to `checkoutUrl`; when
 * they finish (or close the page) Korapay redirects to `redirectUrl` with
 * `?reference=` appended, and posts charge.success to `notificationUrl`.
 */
export async function initializeCharge(input: {
  reference: string;
  amountKobo: number;
  email: string;
  name?: string;
  redirectUrl: string;
  notificationUrl?: string;
  narration: string;
}) {
  if (input.reference.length > KORAPAY_REFERENCE_MAX) {
    throw new KorapayError(
      `reference should have at most ${KORAPAY_REFERENCE_MAX} characters`,
      400,
      "reference"
    );
  }
  const data = await korapay<{ reference: string; checkout_url: string }>("POST", "/charges/initialize", {
    body: {
      amount: koboToWholeNaira(input.amountKobo),
      currency: KORAPAY_CURRENCY,
      reference: input.reference,
      redirect_url: input.redirectUrl,
      ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
      narration: input.narration.slice(0, 120),
      // The platform absorbs the fee, as it did before, so the buyer pays the
      // listed price and the verified amount always equals what we stored.
      merchant_bears_cost: true,
      customer: {
        email: input.email,
        ...(input.name ? { name: input.name.slice(0, 80) } : {}),
      },
    },
  });
  if (!data?.checkout_url) throw new KorapayError("Korapay did not return a checkout URL", 502, "no_checkout_url");
  return { reference: data.reference ?? input.reference, checkoutUrl: data.checkout_url };
}

export type KorapayCharge = {
  reference: string;
  /** success | processing | pending | failed | expired ... as Korapay reports it. */
  status: string;
  amountKobo: number | null;
  /** What the customer actually paid; Korapay sometimes reports 0 here on success. */
  amountPaidKobo: number | null;
  currency: string;
};

/** Verify a charge server-side. Throws KorapayError (status 404) for an unknown reference. */
export async function verifyCharge(reference: string): Promise<KorapayCharge> {
  const data = await korapay<{
    reference: string;
    status: string;
    amount: string | number;
    amount_paid?: string | number;
    currency: string;
  }>("GET", `/charges/${encodeURIComponent(reference)}`);
  return {
    reference: data.reference,
    status: String(data.status ?? "").toLowerCase(),
    amountKobo: nairaToKobo(data.amount),
    amountPaidKobo: nairaToKobo(data.amount_paid),
    currency: String(data.currency ?? "").toUpperCase(),
  };
}

/** Charge states after which the buyer can no longer pay on that reference. */
export function isFailedChargeStatus(status: string) {
  return status === "failed" || status === "expired" || status === "cancelled";
}

/**
 * The only test that lets value be given: Korapay says success, for our
 * reference, in naira, for exactly the amount we asked for, and (when Korapay
 * reports it) the customer paid at least that much.
 */
export function chargeSettlesExactly(charge: KorapayCharge, reference: string, expectedKobo: number) {
  if (charge.status !== "success") return { ok: false as const, reason: "not successful" };
  if (charge.reference && charge.reference !== reference) return { ok: false as const, reason: "reference mismatch" };
  if (charge.currency !== KORAPAY_CURRENCY) return { ok: false as const, reason: `unexpected currency ${charge.currency || "(none)"}` };
  if (charge.amountKobo !== expectedKobo) return { ok: false as const, reason: "amount does not match" };
  if (charge.amountPaidKobo !== null && charge.amountPaidKobo > 0 && charge.amountPaidKobo < expectedKobo) {
    return { ok: false as const, reason: "customer paid less than the amount due" };
  }
  return { ok: true as const };
}

// ---------------------------------------------------------------- banks

export type Bank = { name: string; code: string };

let bankCache: { at: number; banks: Bank[] } | null = null;

/** Nigerian banks Korapay can pay out to, cached for 12 hours. */
export async function listBanks(): Promise<Bank[]> {
  if (bankCache && Date.now() - bankCache.at < 12 * 60 * 60 * 1000) return bankCache.banks;
  // This endpoint rejects the secret key; it is authorised with the public key.
  const data = await korapay<{ name: string; code: string; country?: string }[]>(
    "GET",
    "/misc/banks?countryCode=NG",
    { key: "public" }
  );
  const seen = new Set<string>();
  const banks = (Array.isArray(data) ? data : [])
    .filter((b) => b?.code && b?.name && (!b.country || b.country === "NG"))
    .filter((b) => !seen.has(b.code) && Boolean(seen.add(b.code)))
    .map((b) => ({ name: b.name.trim(), code: b.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!banks.length) throw new KorapayError("Korapay returned no banks", 502, "no_banks");
  bankCache = { at: Date.now(), banks };
  return banks;
}

/** Look up the account holder's name for a Nigerian bank account. */
export async function resolveBankAccount(accountNumber: string, bankCode: string) {
  const data = await korapay<{ bank_name: string; bank_code: string; account_number: string; account_name: string }>(
    "POST",
    "/misc/banks/resolve",
    // Korapay rejects the country code "NG" here despite the docs; it wants the currency.
    { body: { bank: bankCode, account: accountNumber, currency: KORAPAY_CURRENCY } }
  );
  const accountName = String(data?.account_name ?? "").trim();
  if (!accountName) throw new KorapayError("Korapay could not resolve that account", 422, "unresolved");
  return {
    accountName,
    accountNumber: String(data.account_number ?? accountNumber),
    bankName: String(data.bank_name ?? "").trim(),
    bankCode: String(data.bank_code ?? bankCode),
  };
}

// ---------------------------------------------------------------- payouts

export type KorapayPayout = {
  reference: string;
  /** processing | success | failed (pending is treated like processing). */
  status: string;
  amountKobo: number | null;
  feeKobo: number | null;
  currency: string;
  message: string;
};

function shapePayout(data: {
  reference: string;
  status: string;
  amount?: string | number;
  fee?: string | number;
  currency?: string;
  message?: string;
}): KorapayPayout {
  return {
    reference: data.reference,
    status: String(data.status ?? "").toLowerCase(),
    amountKobo: nairaToKobo(data.amount),
    feeKobo: nairaToKobo(data.fee),
    currency: String(data.currency ?? "").toUpperCase(),
    message: String(data.message ?? ""),
  };
}

/**
 * Send money from the Korapay NGN balance to a Nigerian bank account. The
 * reference must be unique per attempt. On a non-definitive KorapayError the
 * payout may still have been created: look it up with getPayout before
 * treating it as failed.
 */
export async function disburseToBank(input: {
  reference: string;
  amountKobo: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  email: string;
  narration: string;
}) {
  if (input.reference.length < 5) throw new KorapayError("Payout reference too short", 400, "reference");
  const data = await korapay<Parameters<typeof shapePayout>[0]>("POST", "/transactions/disburse", {
    body: {
      reference: input.reference,
      destination: {
        type: "bank_account",
        amount: koboToNaira2dp(input.amountKobo),
        currency: KORAPAY_CURRENCY,
        narration: input.narration.slice(0, 100),
        bank_account: { bank: input.bankCode, account: input.accountNumber },
        customer: { name: input.accountName.slice(0, 80), email: input.email },
      },
    },
  });
  return shapePayout(data);
}

/** Payout status lookup. Throws KorapayError (status 404) if Korapay has no such payout. */
export async function getPayout(reference: string) {
  const data = await korapay<Parameters<typeof shapePayout>[0]>("GET", `/transactions/${encodeURIComponent(reference)}`);
  return shapePayout(data);
}

/** Korapay balances, in kobo, keyed by currency. */
export async function getBalances() {
  const data = await korapay<Record<string, { available_balance?: number | string; pending_balance?: number | string }>>(
    "GET",
    "/balances"
  );
  const out: Record<string, { availableKobo: number; pendingKobo: number }> = {};
  for (const [currency, b] of Object.entries(data ?? {})) {
    out[currency] = { availableKobo: nairaToKobo(b?.available_balance) ?? 0, pendingKobo: nairaToKobo(b?.pending_balance) ?? 0 };
  }
  return out;
}

// ---------------------------------------------------------------- webhooks

/**
 * Korapay signs webhooks with `x-korapay-signature`: the hex HMAC-SHA256 of
 * ONLY the `data` object, serialised with JSON.stringify, keyed by the secret
 * key. Returns the parsed event when the signature is genuine, otherwise null.
 */
export function parseSignedWebhook(rawBody: string, signature: string | null) {
  const key = secretKey();
  if (!key || !signature) return null;
  let event: { event?: unknown; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!event || typeof event !== "object" || event.data === undefined) return null;
  const expected = crypto.createHmac("sha256", key).update(JSON.stringify(event.data)).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  // timingSafeEqual throws on a length mismatch, hence the guard.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return event as {
    event?: string;
    data?: { reference?: string; payment_reference?: string; status?: string; amount?: unknown; currency?: string };
  };
}

/** Where Korapay should post charge notifications for this deployment. */
export const KORAPAY_WEBHOOK_PATH = "/api/webhooks/korapay";
