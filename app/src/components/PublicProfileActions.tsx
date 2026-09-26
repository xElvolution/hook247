"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MessageCircle, MessageSquareText, User, UserCheck, UserPlus } from "lucide-react";
import ReportButton from "./ReportButton";
import TipButton from "./coins/TipButton";
import { formatWhatsApp, whatsappHref } from "@/lib/whatsapp";

export default function PublicProfileActions({
  authed,
  tippable = false,
  following: initiallyFollowing = false,
  isMine,
  profileName,
  userId,
  whatsapp,
  country,
}: {
  authed: boolean;
  isMine: boolean;
  profileName: string;
  userId: string;
  whatsapp: string;
  country?: string;
  tippable?: boolean;
  following?: boolean;
}) {
  const href = whatsappHref(whatsapp, profileName, country);
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState<"" | "follow" | "message">("");
  const [error, setError] = useState("");

  function toLogin() {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }

  async function toggleFollow() {
    if (!authed) return toLogin();
    setBusy("follow");
    setError("");
    const next = !following;
    setFollowing(next);
    const res = await fetch("/api/follow", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    setBusy("");
    if (!res?.ok) {
      setFollowing(!next);
      const body = res ? await res.json().catch(() => ({})) : {};
      setError(body.error ?? "Could not update. Try again.");
      return;
    }
    router.refresh();
  }

  async function message() {
    if (!authed) return toLogin();
    setBusy("message");
    setError("");
    const res = await fetch("/api/messages/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !body.matchId) {
      setBusy("");
      setError(body.error ?? "Could not open the chat. Try again.");
      return;
    }
    router.push(`/matches/${body.matchId}`);
  }

  if (isMine) {
    return (
      <Link href="/profile" className="btn-primary w-full text-sm sm:w-auto">
        <User className="h-4 w-4" /> Edit profile
      </Link>
    );
  }

  return (
    <div>
      <div className="profile-social-actions">
        <button
          type="button"
          className={following ? "btn-ghost text-sm" : "btn-primary text-sm"}
          onClick={() => void toggleFollow()}
          disabled={busy === "follow"}
          aria-pressed={following}
        >
          {busy === "follow" ? <Loader2 className="h-4 w-4 animate-spin" /> : following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {following ? "Following" : "Follow"}
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={() => void message()} disabled={busy === "message"}>
          {busy === "message" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />} Message
        </button>
      </div>
      {error ? <p className="coin-flash mb-2" data-tone="bad">{error}</p> : null}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="btn-primary w-full text-sm">
          <MessageCircle className="h-4 w-4" /> WhatsApp {profileName}
        </a>
      ) : (
        <p className="text-sm text-muted">This profile has no WhatsApp number yet.</p>
      )}
      {whatsapp && (
        <p className="mt-2 text-xs text-muted">Number: {formatWhatsApp(whatsapp, country)}</p>
      )}
      {tippable && (
        <TipButton
          toUserId={userId}
          toName={profileName}
          source="profile"
          guest={!authed}
          className="btn-ghost mt-2 w-full text-sm"
          label={`Send ${profileName} a tip`}
        />
      )}
      <p className="mt-3 text-xs text-muted">
        No account needed. Chat on WhatsApp to ask availability and rates.
      </p>
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
