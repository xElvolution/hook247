"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import LoadingScreen from "@/components/LoadingScreen";
import PasswordField from "@/components/PasswordField";

function safeNext(value: string | null) {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/";
  if (value.startsWith("/502test")) return "/";
  return value;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"real" | "demo" | false>(false);
  const showDemo =
    process.env.NEXT_PUBLIC_ALLOW_MOCK_LOGIN === "1" ||
    process.env.NODE_ENV !== "production";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy("real");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
      router.push(data.hasProfile ? next : "/onboarding");
      router.refresh();
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin() {
    setError("");
    setBusy("demo");
    try {
      const res = await fetch("/api/auth/mock", {
        method: "POST",
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Demo login is unavailable.");
        return;
      }
      router.push("/");
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
        <LoadingScreen fill={false} label="Signing you in" />
      </div>
    )}
    <AuthShell
      title={
        <>
          Welcome <span className="text-gradient">back</span>
        </>
      }
      subtitle="Log in to manage your profile."
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
          placeholder="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-muted hover:text-white"
          >
            Forgot password?
          </Link>
        </div>

        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={!!busy} className="btn-primary w-full">
          {busy === "real" ? "Logging in…" : "Log in"}
        </button>
      </form>

      {showDemo && (
        <button
          type="button"
          disabled={!!busy}
          onClick={demoLogin}
          className="btn-ghost mt-3 w-full"
        >
          {busy === "demo" ? "Entering…" : "Continue as demo"}
        </button>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-gradient">
          Sign up to get hooked
        </Link>
      </p>
    </AuthShell>
    </>
  );
}
