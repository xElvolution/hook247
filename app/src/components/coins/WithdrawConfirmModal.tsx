"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Banknote, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { naira } from "./format";
import "./withdraw-confirm.css";

export type WithdrawQuote = { grossKobo: number; feeKobo: number; payoutKobo: number; feeBps: number };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Confirm step for an earnings withdrawal. Every figure comes from the server quote. */
export default function WithdrawConfirmModal({
  quote,
  bankName,
  accountNumber,
  accountName,
  busy,
  error,
  notice,
  onConfirm,
  onCancel,
}: {
  quote: WithdrawQuote;
  bankName: string;
  accountNumber: string;
  accountName: string;
  busy: boolean;
  error: string;
  notice: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(busy);
  const cancelFn = useRef(onCancel);

  useEffect(() => {
    busyRef.current = busy;
    cancelFn.current = onCancel;
  }, [busy, onCancel]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) cancelFn.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return event.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      html.style.overflow = previous.html;
      body.style.overflow = previous.body;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const masked = accountNumber ? `${"*".repeat(Math.max(accountNumber.length - 4, 0))}${accountNumber.slice(-4)}` : "";

  return createPortal(
    <div className="withdraw-confirm-root">
      <div className="withdraw-confirm-backdrop" aria-hidden="true" onClick={() => (!busy ? onCancel() : undefined)} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-confirm-title"
        aria-describedby="withdraw-confirm-desc"
        className="withdraw-confirm-dialog"
      >
        <span className="withdraw-confirm-icon" aria-hidden="true"><Banknote className="h-6 w-6" /></span>
        <p className="withdraw-confirm-kicker">Confirm withdrawal</p>
        <h2 id="withdraw-confirm-title" className="font-display">
          You&apos;ll receive <span className="text-gradient">{naira(quote.payoutKobo)}</span>
        </h2>
        <dl id="withdraw-confirm-desc" className="withdraw-confirm-breakdown">
          <div><dt>Withdrawal amount</dt><dd>{naira(quote.grossKobo)}</dd></div>
          <div><dt>Fee ({(quote.feeBps / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}%)</dt><dd>{quote.feeKobo ? `-${naira(quote.feeKobo)}` : naira(0)}</dd></div>
          <div data-total="true"><dt>Final amount</dt><dd>{naira(quote.payoutKobo)}</dd></div>
        </dl>

        {accountName || bankName ? (
          <div className="withdraw-confirm-account">
            <Landmark className="h-4 w-4 shrink-0" />
            <span>
              <strong>{accountName || "Your account"}</strong>
              <small>{[bankName, masked].filter(Boolean).join(" · ")}</small>
            </span>
          </div>
        ) : null}

        <p className="withdraw-confirm-note">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Payouts are checked by our team before they are sent. The amount is held from your Earnings Wallet until then and returned in full if the payout is declined.</span>
        </p>

        {notice ? <p className="withdraw-confirm-flash" data-tone="info" role="status">{notice}</p> : null}
        {error ? <p className="withdraw-confirm-flash" data-tone="bad" role="alert">{error}</p> : null}

        <div className="withdraw-confirm-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={onConfirm}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending request...</> : "Confirm withdrawal"}
          </button>
          <button ref={cancelRef} type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
