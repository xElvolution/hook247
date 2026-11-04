import { NextResponse } from "next/server";
import { parseSignedWebhook } from "@/lib/korapay";
import { fulfilPayment } from "@/lib/fulfilPayment";
import { fulfilCoinPurchase, isCoinReference } from "@/lib/coinPurchases";
import { settleTransferEvent } from "@/lib/coinPayouts";

export const dynamic = "force-dynamic";

/**
 * Korapay webhook: charge.success / charge.failed for checkouts and
 * transfer.success / transfer.failed for payouts.
 *
 * The x-korapay-signature header is checked before anything else. Even then
 * the event is only a nudge: every handler re-reads the transaction from the
 * Korapay API and acts on that, and every handler is idempotent, so a replayed
 * or out-of-order event can never credit, pay or refund twice.
 *
 * Korapay retries for up to 72 hours on any non-200, so a 500 is returned only
 * when a retry could help (our database or Korapay's API was unavailable).
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const event = parseSignedWebhook(raw, request.headers.get("x-korapay-signature"));
  if (!event) {
    return NextResponse.json({ error: "Invalid or missing signature" }, { status: 401 });
  }

  const type = String(event.event ?? "");
  const reference = String(event.data?.reference ?? event.data?.payment_reference ?? "").trim();
  if (!reference) return NextResponse.json({ ok: true, ignored: "no reference" });

  if (type.startsWith("transfer.")) {
    try {
      const state = await settleTransferEvent(type, reference);
      return NextResponse.json({ ok: true, state, reference });
    } catch (err) {
      console.error("Korapay transfer webhook failed:", (err as Error).message);
      return NextResponse.json({ ok: false, retry: true, reference }, { status: 500 });
    }
  }

  if (type !== "charge.success" && type !== "charge.failed") {
    return NextResponse.json({ ok: true, ignored: type || "unknown event" });
  }

  try {
    if (isCoinReference(reference)) {
      const result = await fulfilCoinPurchase(reference);
      if (!result.ok && result.state === "pending" && type === "charge.success") {
        // Korapay said success but verification did not agree yet: retry later.
        return NextResponse.json({ ok: false, retry: true, reference }, { status: 500 });
      }
      return NextResponse.json({ ok: result.ok, state: result.state, reference });
    }

    const result = await fulfilPayment(reference);
    if (!result.ok && result.state === "unknown") {
      console.warn(`Korapay webhook for unknown reference: ${reference}`);
      return NextResponse.json({ ok: true, unknown: reference });
    }
    if (!result.ok && result.state === "pending" && type === "charge.success") {
      return NextResponse.json({ ok: false, retry: true, reference }, { status: 500 });
    }
    return NextResponse.json({ ok: result.ok, state: result.state, reference });
  } catch (err) {
    console.error("Korapay charge webhook failed:", (err as Error).message);
    return NextResponse.json({ ok: false, retry: true, reference }, { status: 500 });
  }
}
