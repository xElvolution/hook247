"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

const REASONS = [
  { value: "SPAM", label: "Spam or advertising" },
  { value: "HARASSMENT", label: "Harassment or abuse" },
  { value: "NUDITY", label: "Explicit content" },
  { value: "UNDERAGE", label: "Appears underage" },
  { value: "SCAM", label: "Scam or fraud" },
  { value: "IMPERSONATION", label: "Impersonation / fake profile" },
  { value: "OTHER", label: "Something else" },
] as const;

export default function ReportButton({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: "USER" | "POST" | "COMMENT";
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason, details }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(data.error ?? "The report could not be sent.");
      return;
    }
    setDone(data.message ?? "Thanks — our team will review this.");
    setOpen(false);
  }

  if (done) {
    return (
      <p className="text-xs text-muted" role="status">
        {done}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-ink"
      >
        <Flag className="h-3.5 w-3.5" /> {label}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 rounded-xl border border-line bg-card p-3">
      <p className="text-sm font-semibold">What is wrong here?</p>

      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Add anything that would help us review this (optional)"
        className="mt-2 w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
      />

      {error && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary flex-1 text-sm">
          {busy ? "Sending..." : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
