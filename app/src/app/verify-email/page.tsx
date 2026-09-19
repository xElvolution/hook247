"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, CheckCircle2 } from "lucide-react";
import AuthShell from "@/components/AuthShell";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: code.trim() }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Verification failed. Check the code and try again.");
        return;
      }
      setSuccess("Email verified! Redirecting...");
      setTimeout(() => router.push("/"), 1500);
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    setSuccess("");
    setSendBusy(true);
    try {
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
        signal: AbortSignal.timeout(25000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not send code. Try again later.");
        return;
      }
      setSuccess("Code sent. Check your inbox.");
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setSendBusy(false);
    }
  }

  return (
    <AuthShell
      title={
        <>
          Verify your <span className="text-gradient">email</span>
        </>
      }
      subtitle="We sent a 6-digit code to your inbox."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            Verification code
          </label>
          <input
            type="text"
            required
            placeholder="123456"
            className="input text-center text-2xl font-mono tracking-widest"
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

        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> {success}
          </p>
        )}

        <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full">
          {busy ? "Verifying…" : "Verify email"}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <button
          type="button"
          onClick={resend}
          disabled={sendBusy}
          className="text-sm text-muted hover:text-white"
        >
          <Mail className="inline h-4 w-4" />{" "}
          {sendBusy ? "Sending…" : "Didn't get it? Resend code"}
        </button>
        <Link href="/discover" className="text-xs text-muted hover:text-white">
          Skip for now
        </Link>
      </div>
    </AuthShell>
  );
}
