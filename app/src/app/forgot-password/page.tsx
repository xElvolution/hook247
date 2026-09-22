"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send the code. Try again.");
        return;
      }
      // The API stays silent about unknown addresses, so the copy does too.
      setNotice("If that address has an account, a code is on its way.");
      setStep("reset");
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          email,
          code: code.trim(),
          newPassword,
        }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not reset the password.");
        return;
      }
      setNotice("Password updated. Taking you to the login page…");
      setTimeout(() => router.push("/login"), 1500);
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
          Reset your <span className="text-gradient">password</span>
        </>
      }
      subtitle={
        step === "request"
          ? "We'll email you a 6-digit code."
          : "Enter the code we emailed you and pick a new password."
      }
    >
      {step === "request" ? (
        <form onSubmit={requestCode} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email address"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Sending…" : "Send reset code"}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              Reset code
            </label>
            <input
              type="text"
              required
              placeholder="123456"
              className="input text-center font-mono text-2xl tracking-widest"
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoComplete="off"
            />
            <p className="mt-1.5 text-xs text-muted">
              The code expires in 10 minutes.
            </p>
          </div>
          <PasswordField
            required
            minLength={8}
            placeholder="New password (8+ characters)"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}
          {notice && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="btn-primary w-full"
          >
            {busy ? "Updating…" : "Set new password"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("request");
              setCode("");
              setError("");
              setNotice("");
            }}
            className="w-full text-center text-sm text-muted hover:text-white"
          >
            Use a different email
          </button>
        </form>
      )}

      {step === "request" && notice && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
        </p>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-gradient">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
