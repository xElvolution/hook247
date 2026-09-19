import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { fulfilPayment } from "@/lib/fulfilPayment";

/**
 * Paystack calls this webhook when a transaction reaches a final state.
 * We verify the signature and hand off to the shared fulfilment routine, which
 * is idempotent — a replayed event, or a race with the /premium callback,
 * grants the benefit exactly once.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-paystack-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const raw = await request.text();
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: event.event });
  }

  const reference = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const result = await fulfilPayment(reference);

  if (!result.ok && result.state === "unknown") {
    // Not ours — acknowledge so Paystack stops retrying.
    console.warn(`Webhook received for unknown reference: ${reference}`);
    return NextResponse.json({ ok: true, unknown: reference });
  }

  return NextResponse.json({ ok: result.ok, state: result.state, reference });
}
