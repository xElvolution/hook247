"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    compact ? (
      <button type="button" onClick={() => void logout()} className="profile-hdr-chip" aria-label="Log out">
        <LogOut className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Log out</span>
      </button>
    ) : (
      <button type="button" onClick={() => void logout()} className="btn-ghost !px-4 !py-2.5 text-sm">
        <LogOut className="h-4 w-4" /> Log out
      </button>
    )
  );
}
