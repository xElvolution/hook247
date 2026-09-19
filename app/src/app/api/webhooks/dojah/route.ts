import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  DOJAH_CONFIGURED,
  verifyWebhookSignature,
  readEvent,
} from "@/lib/dojah";

/**
 * Dojah calls this webhook when a verification reaches a final state. We verify
 * the `x-dojah-signature` header (HMAC-SHA256 of the raw body, keyed by our
 * secret), then — only for a passing NIN + selfie-liveness check — flip the
 * profile's verified badge with source DOJAH.
 *
 * The browser's onSuccess is never trusted for this; the signed webhook is the
 * authority, same rule as the Paystack webhook.
 */
export async function POST(request: Request) {
  // Refuse to process anything until the secret is set — otherwise an
  // unsigned/forged event could pass while the integration is half-configured.
  if (!DOJAH_CONFIGURED) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const signature = request.headers.get("x-dojah-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const raw = await request.text();
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const { userId, reference, passed } = readEvent(event);

  if (!userId) {
    // Nothing to attribute this to — acknowledge so Dojah stops retrying.
    console.warn("Dojah webhook without a usable metadata.user_id", { reference });
    return NextResponse.json({ ok: true, ignored: "no user_id" });
  }

  if (!passed) {
    // A failed/abandoned attempt: record nothing, don't grant the badge.
    console.warn(`Dojah verification did not pass for user ${userId}`, { reference });
    return NextResponse.json({ ok: true, verified: false, reference });
  }

  // Idempotent: updateMany over a userId that may already be DOJAH-verified is a
  // harmless no-op, and a replayed event can't do anything a first one didn't.
  const result = await db.profile.updateMany({
    where: { userId },
    data: {
      verified: true,
      verifiedSource: "DOJAH",
      verifiedAt: new Date(),
    },
  });

  if (result.count === 0) {
    console.warn(`Dojah webhook: no profile for user ${userId}`, { reference });
    return NextResponse.json({ ok: true, unknown: userId });
  }

  return NextResponse.json({ ok: true, verified: true, userId, reference });
}
