"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, User } from "lucide-react";
import ReportButton from "./ReportButton";

export default function PublicProfileActions({
  authed,
  isMine,
  profileName,
  userId,
}: {
  authed: boolean;
  isMine: boolean;
  profileName: string;
  userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const returnTo = `/profiles/${encodeURIComponent(userId)}`;
  const signupHref = `/signup?next=${encodeURIComponent(returnTo)}`;

  if (isMine) {
    return (
      <Link href="/profile" className="btn-primary w-full text-sm sm:w-auto">
        <User className="h-4 w-4" /> Manage my profile
      </Link>
    );
  }

  if (!authed) {
    return (
      <div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href={signupHref} className="btn-primary w-full text-sm">
            <Heart className="h-4 w-4" /> Like {profileName}
          </Link>
          <Link href={signupHref} className="btn-ghost w-full text-sm">
            <MessageCircle className="h-4 w-4" /> Send a message
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">
          Viewing profiles is public. Create an account only when you want to connect.
        </p>
      </div>
    );
  }

  async function likeProfile() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/swipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId, liked: true }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (response.status === 401) {
      router.push(signupHref);
      return;
    }
    if (!response.ok) {
      setMessage(data.error ?? "The like could not be sent.");
      return;
    }
    if (data.matched && data.matchId) {
      router.push(`/matches/${data.matchId}`);
      return;
    }
    setMessage(`You liked ${profileName}. We will let you know if it is mutual.`);
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={likeProfile}
          disabled={busy}
          className="btn-primary w-full text-sm"
        >
          <Heart className="h-4 w-4" /> {busy ? "Sending..." : `Like ${profileName}`}
        </button>
        <button
          type="button"
          onClick={() => setMessage("Messaging opens after you both like each other.")}
          className="btn-ghost w-full text-sm"
        >
          <MessageCircle className="h-4 w-4" /> Send a message
        </button>
      </div>
      {message && (
        <p className="mt-3 text-xs text-muted" role="status">
          {message}
        </p>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <ReportButton
          targetType="USER"
          targetId={userId}
          label={`Report ${profileName}`}
        />
      </div>
    </div>
  );
}
