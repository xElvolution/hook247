"use client";

import Link from "next/link";
import { MessageCircle, User } from "lucide-react";
import ReportButton from "./ReportButton";
import TipButton from "./coins/TipButton";
import { formatWhatsApp, whatsappHref } from "@/lib/whatsapp";

export default function PublicProfileActions({
  authed,
  tippable = false,
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
}) {
  const href = whatsappHref(whatsapp, profileName, country);

  if (isMine) {
    return (
      <Link href="/profile" className="btn-primary w-full text-sm sm:w-auto">
        <User className="h-4 w-4" /> Edit profile
      </Link>
    );
  }

  return (
    <div>
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
