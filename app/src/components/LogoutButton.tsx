"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button type="button" onClick={() => void logout()} className="btn-ghost !px-4 !py-2.5 text-sm">
      <LogOut className="h-4 w-4" /> Log out
    </button>
  );
}
