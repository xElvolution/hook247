import Link from "next/link";
import { BadgeCheck, ScanFace } from "lucide-react";

/** "Get verified" card: links to the in-app face verification flow. */
export default function VerifyCard({ verified }: { verified: boolean }) {
  return (
    <div className="glass rounded-3xl p-6">
      <h3 className="font-display flex items-center gap-2 font-bold">
        <BadgeCheck className="h-4 w-4 text-sky-400" /> Get verified
      </h3>
      <p className="mt-1.5 text-sm text-muted">
        {verified
          ? "Your profile is verified. The badge shows on every card you appear in."
          : "Free. Upload a photo of your face and take a quick live selfie. No ID card or NIN needed."}
      </p>
      {verified ? (
        <span className="btn-ghost mt-4 w-full !py-2.5 text-sm opacity-60">Already verified</span>
      ) : (
        <Link href="/verify" className="btn-primary mt-4 w-full !py-2.5 text-sm">
          <ScanFace className="h-4 w-4" /> Verify my face
        </Link>
      )}
    </div>
  );
}
