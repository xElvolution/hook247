import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Note: this file is `proxy.ts`, not `middleware.ts` — Next 16 renamed the
// convention and errors if you set a `runtime` here (it is always Node.js).
//
// Everything under /502test is the admin console. To anyone without a valid
// admin cookie it must be indistinguishable from a real gateway failure, so we
// return a genuine 502 with a plausible error body rather than redirecting to a
// login page (a redirect would confirm that something is there).

const adminSecret = new TextEncoder().encode(
  `${process.env.AUTH_SECRET || "hook247-dev-secret"}::admin`
);

/** The body a bare nginx/ALB 502 would produce. No app branding, no hints. */
const GATEWAY_ERROR = `<!DOCTYPE html>
<html>
<head><title>502 Bad Gateway</title></head>
<body>
<center><h1>502 Bad Gateway</h1></center>
<hr><center>nginx</center>
</body>
</html>
`;

function badGateway() {
  return new NextResponse(GATEWAY_ERROR, {
    status: 502,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Never let an intermediary cache the decoy, or a later authenticated
      // request could be served the 502 from cache.
      "cache-control": "no-store, must-revalidate",
      server: "nginx",
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/502test")) return NextResponse.next();

  const token = request.cookies.get("hook247_ops")?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, adminSecret);
      if (payload.ops === true) return NextResponse.next();
    } catch {
      // Fall through: an expired or forged cookie is treated exactly like no
      // cookie at all.
    }
  }

  // The sign-in form is the one page an unauthenticated admin must reach. It
  // is a Server Action posting back to its own URL, so the POST has to pass
  // through here too — hence no method check.
  if (pathname === "/502test/enter") return NextResponse.next();

  // Everything else under the console shows the decoy, so the dashboard's
  // existence is never confirmed to someone guessing paths.
  return badGateway();
}

export const config = {
  // Only guard the console. Excluding _next and static assets keeps the proxy
  // off the hot path for everything else in the app.
  matcher: ["/502test", "/502test/:path*"],
};
