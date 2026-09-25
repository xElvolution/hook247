"use client";

import Link from "next/link";
import { Coins, X } from "lucide-react";
import type { Gift } from "./types";

export default function GiftSheet({
  gifts,
  balance,
  sendingId,
  error,
  onSend,
  onClose,
}: {
  gifts: Gift[];
  balance: number;
  sendingId: string | null;
  error: string;
  onSend: (gift: Gift) => void;
  onClose: () => void;
}) {
  return (
    <div className="gift-sheet-backdrop" onClick={onClose}>
      <section className="gift-sheet" role="dialog" aria-label="Send a gift" onClick={(event) => event.stopPropagation()}>
        <header>
          <strong>Send a gift</strong>
          <span className="gift-sheet-balance"><Coins className="h-3.5 w-3.5" /> {balance.toLocaleString("en-NG")}</span>
          <button type="button" onClick={onClose} aria-label="Close gifts"><X className="h-4 w-4" /></button>
        </header>
        <div className="gift-grid">
          {gifts.map((gift) => {
            const short = gift.coins > balance;
            return (
              <button
                key={gift.id}
                type="button"
                className={`gift-tile ${short ? "is-short" : ""}`}
                disabled={sendingId !== null}
                onClick={() => onSend(gift)}
              >
                <span className="gift-tile-emoji" aria-hidden="true">{gift.emoji}</span>
                <span className="gift-tile-name">{gift.name}</span>
                <small><Coins className="h-3 w-3" /> {gift.coins.toLocaleString("en-NG")}</small>
                {sendingId === gift.id ? <i className="gift-tile-sending">Sending</i> : null}
              </button>
            );
          })}
        </div>
        {error ? <p className="gift-sheet-error" role="alert">{error}</p> : null}
        <Link href="/coins" className="gift-sheet-topup">Buy coins</Link>
      </section>
    </div>
  );
}
