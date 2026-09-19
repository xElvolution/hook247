"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("You must confirm you are 18 or older.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, birthDate }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error ??
            (res.status >= 500
              ? "The server is waking up. Please try again."
              : "Something went wrong.")
        );
        return;
      }
      // The account exists and is signed in either way. If the code could not be
      // sent, say so rather than dropping the user at a code prompt with no code.
      if (data.emailSent === false) {
        setError(
          data.message ??
            "Account created, but we could not email your code. You can resend it from the verification page."
        );
        return;
      }
      router.push(`/onboarding?birth=${encodeURIComponent(birthDate)}`);
      router.refresh();
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={
        <>
          Join the <span className="text-gradient">vibe</span>
        </>
      }
      subtitle="Free to join. Two minutes to set up."
    >
      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="Email address"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            Date of birth
          </label>
          <input
            type="date"
            required
            className="input [color-scheme:dark]"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#ff2d78]"
          />
          I confirm I am 18 years or older and agree to keep Hook247 respectful
          and safe.
        </label>

        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already a member?{" "}
        <Link href="/login" className="font-semibold text-gradient">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
