/** Canonical public origin of the dating app (emails, absolute links). */
export function canonicalAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.hooks247.com").replace(
    /\/$/,
    ""
  );
}

/**
 * Origin of the request currently hitting the app. Used for Paystack return
 * URLs so checkout still completes when the site is reached via an alternate
 * host (sslip.io while DNS propagates, www, etc.).
 */
export function requestAppUrl(req: Request) {
  const forwarded = req.headers.get("x-forwarded-host");
  const host = (forwarded ?? req.headers.get("host") ?? "")
    .split(",")[0]
    .trim();
  if (!host) return canonicalAppUrl();
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}
