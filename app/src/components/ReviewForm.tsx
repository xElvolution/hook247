"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";

export default function ReviewForm({
  authed,
  canReview,
  listingUserId,
  onPosted,
}: {
  authed: boolean;
  canReview: boolean;
  listingUserId: string;
  onPosted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!authed) {
    return (
      <p className="mt-4 text-sm text-muted">
        <Link href={`/login?next=${encodeURIComponent(`/profiles/${listingUserId}`)}`} className="text-[#e7658a]">
          Log in
        </Link>{" "}
        to leave a review.
      </p>
    );
  }
  if (!canReview) {
    return <p className="mt-4 text-sm text-muted">You cannot review your own profile.</p>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingUserId, rating, body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not post review.");
      return;
    }
    setBody("");
    setRating(0);
    onPosted();
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-3 rounded-xl border border-line bg-black/20 p-4">
      <p className="text-sm font-semibold">Write a review</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className="p-1"
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
          >
            <Star className={`h-6 w-6 ${star <= rating ? "fill-[#df3a6a] text-[#df3a6a]" : "text-white/30"}`} />
          </button>
        ))}
      </div>
      <textarea
        className="min-h-24 w-full rounded-xl border border-line bg-black/30 p-3 text-sm"
        maxLength={600}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="How was the booking? Be honest and specific."
        required
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-primary text-sm" type="submit" disabled={busy || rating < 1}>
        {busy ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
