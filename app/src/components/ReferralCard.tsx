import Link from "next/link";
import { Gift } from "lucide-react";

export default function ReferralCard() {
  return (
    <section className="profile-detail-section mt-5">
      <p className="section-kicker">Grow</p>
      <h2 className="font-display mt-1.5 flex items-center gap-2 text-2xl font-bold">
        <Gift className="h-5 w-5 text-[#df3a6a]" /> Referrals
      </h2>
      <p className="mt-2 text-sm text-muted">
        One level only. You earn when someone you invited pays for a profile plan.
      </p>
      <Link href="/referrals" className="btn-primary mt-4 inline-flex text-sm">
        Open referral dashboard
      </Link>
    </section>
  );
}

