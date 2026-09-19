"use client";

import { useActionState } from "react";
import { enterAction } from "./actions";

// Styled to look like a plain infrastructure diagnostic rather than a product
// login, so a screenshot or a shoulder-surf gives nothing away.
export default function EnterForm() {
  const [error, formAction, pending] = useActionState<string | null, FormData>(
    enterAction,
    null
  );

  return (
    <form action={formAction} style={{ marginTop: 24 }}>
      <label
        htmlFor="password"
        style={{ display: "block", fontSize: 13, color: "#666" }}
      >
        Diagnostic key
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="off"
        autoFocus
        required
        style={{
          marginTop: 6,
          width: 280,
          padding: "8px 10px",
          border: "1px solid #ccc",
          borderRadius: 3,
          fontFamily: "monospace",
          fontSize: 14,
        }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{
          marginLeft: 8,
          padding: "8px 16px",
          border: "1px solid #ccc",
          borderRadius: 3,
          background: "#f5f5f5",
          cursor: pending ? "default" : "pointer",
          fontSize: 14,
        }}
      >
        {pending ? "…" : "Submit"}
      </button>
      {error ? (
        <p style={{ marginTop: 10, fontSize: 13, color: "#a00" }}>{error}</p>
      ) : null}
    </form>
  );
}
