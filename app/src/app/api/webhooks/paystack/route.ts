import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { fulfilPayment } from "@/lib/fulfilPayment";
import { fulfilCoinPurchase, isCoinReference } from "@/lib/coinPurchases";
import { settleTransferEvent } from "@/lib/coinPayouts";

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

  if (event.event === "transfer.success" || event.event === "transfer.failed" || event.event === "transfer.reversed") {
    const reference = event.data?.reference;
    if (!reference) return NextResponse.json({ ok: true, ignored: "no reference" });
    try {
      const state = await settleTransferEvent(event.event, reference);
      return NextResponse.json({ ok: true, state, reference });
    } catch (err) {
      console.error("Transfer webhook failed:", err);
      return NextResponse.json({ ok: false, retry: true, reference }, { status: 500 });
    }
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: event.event });
  }

  const reference = event.data?.reference;
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  if (isCoinReference(reference)) {
    try {
      const result = await fulfilCoinPurchase(reference);
      if (!result.ok && result.state === "pending") {
        // Paystack said success but verify did not agree yet: ask for a retry.
        return NextResponse.json({ ok: false, retry: true, reference }, { status: 500 });
      }
      return NextResponse.json({ ok: result.ok, state: result.state, reference });
    } catch (err) {
      console.error("Coin purchase webhook failed:", err);
      return NextResponse.json({ ok: false, retry: true, reference }, { status: 500 });
    }
  }

  try {
    const result = await fulfilPayment(reference);

    if (!result.ok && result.state === "unknown") {
      console.warn(`Webhook received for unknown reference: ${reference}`);
      return NextResponse.json({ ok: true, unknown: reference });
    }

    return NextResponse.json({ ok: result.ok, state: result.state, reference });
  } catch (err) {
    console.error("Paystack webhook fulfilment failed:", err);
    return NextResponse.json({ ok: false, retry: true, reference }, { status: 500 });
  }
}
