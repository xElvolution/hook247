"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import LoadingScreen from "@/components/LoadingScreen";
import PasswordField from "@/components/PasswordField";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("ref")?.trim().toUpperCase() ?? "";
    if (fromUrl) {
      localStorage.setItem("hook247_ref", fromUrl);
      setReferralCode(fromUrl);
      return;
    }
    const stored = localStorage.getItem("hook247_ref")?.trim().toUpperCase() ?? "";
    if (stored) setReferralCode(stored);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!agreed) {
      setError("You must confirm you are 18 or older.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword, birthDate, referralCode }),
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
      const next = `/verify-email?birth=${encodeURIComponent(birthDate)}${
        data.emailSent === false ? "&mail=failed" : ""
      }`;
      router.push(next);
      router.refresh();
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    {busy && (
      <div className="app-loading-overlay">
        <LoadingScreen fill={false} label="Creating your account" />
      </div>
    )}
    <AuthShell
      title={
        <>
          Sign up to <span className="text-gradient">get hooked</span>
        </>
      }
      subtitle={
        referralCode
          ? `Feature your profile. Referred with code ${referralCode}.`
          : "Feature your profile. Free to join, two minutes to go live."
      }
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
        <PasswordField
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <PasswordField
          required
          minLength={8}
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
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
          I confirm I am 18 years or older and agree to keep Hooks247 respectful
          and safe.
        </label>

        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Creating account…" : "Get hooked"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already a member?{" "}
        <Link href="/login" className="font-semibold text-gradient">
          Log in
        </Link>
      </p>
    </AuthShell>
    </>
  );
}
