import type { Metadata } from "next";
import EnterForm from "./EnterForm";

// Keep the console out of search indexes even if the path ever leaks.
export const metadata: Metadata = {
  title: "502 Bad Gateway",
  robots: { index: false, follow: false },
};

/**
 * The console's sign-in page, at /502test/enter. It is the one path under
 * /502test the proxy lets through without an admin cookie; every other path
 * there returns the static decoy instead.
 *
 * It keeps the gateway-error chrome so a stray visitor sees an error page with
 * an unremarkable form rather than something obviously worth attacking. The
 * root layout wraps this in the app's dark theme, so the chrome is painted by a
 * fixed full-bleed panel rather than by <html>/<body> — a nested document would
 * be invalid markup.
 */
export default function EnterPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#fff",
        color: "#000",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "60px 20px",
        textAlign: "center",
        overflow: "auto",
      }}
    >
      <h1 style={{ fontWeight: 400, fontSize: 28, margin: 0 }}>
        502 Bad Gateway
      </h1>
      <hr
        style={{
          border: 0,
          borderTop: "1px solid #ddd",
          margin: "20px auto",
          maxWidth: 600,
        }}
      />
      <p style={{ fontSize: 13, color: "#666", margin: 0 }}>nginx</p>
      <EnterForm />
    </div>
  );
}
