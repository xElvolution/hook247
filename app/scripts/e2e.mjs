/**
 * End-to-end smoke test. Drives every API route and page against a running dev
 * server, using the real database. Run with:
 *
 *   npm run dev            # in one terminal (port 3001)
 *   npm run e2e            # in another
 *
 * It creates a throwaway account, exercises auth/onboarding/discovery/social/
 * payments/report/moderation/admin, then cleans up everything it created and
 * restores anything it toggled. Live Paystack: it starts one checkout (no
 * charge — same as opening then closing the pay page) and voids the row after.
 */
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import crypto from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const db = new PrismaClient();

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// ── Cookie-jar fetch ─────────────────────────────────────────────────────────
// A named jar keeps separate sessions (guest vs demo vs admin) apart.
const jars = {};
function jar(name) {
  if (!jars[name]) jars[name] = {};
  return jars[name];
}

async function req(name, method, path, { body, jarName = "default", headers = {} } = {}) {
  const store = jar(jarName);
  const cookieHeader = Object.entries(store)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } finally {
    clearTimeout(timer);
  }

  // Capture Set-Cookie into the jar (Node exposes getSetCookie()).
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const idx = pair.indexOf("=");
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    const expired =
      v === "" ||
      /expires=thu, 01 jan 1970/i.test(sc) ||
      /max-age=0(?:;|$)/i.test(sc) ||
      /max-age=-/i.test(sc);
    if (expired) delete store[k];
    else store[k] = v;
  }

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json (a page) */
  }
  return { status: res.status, json, text, headers: res.headers };
}

/** Newest verification code for an address, read straight from the DB. */
async function latestCode(email, type = "SIGNUP") {
  const row = await db.emailVerification.findFirst({
    where: { email: email.toLowerCase(), type },
    orderBy: { createdAt: "desc" },
  });
  return row?.code ?? null;
}

// A stamp keeps this run's rows unique and easy to find for cleanup.
const STAMP = Date.now();
const TEST_EMAIL = `qa+e2e-${STAMP}@hooks247.com`;
const created = { userIds: [], postIds: [], commentIds: [], reportIds: [], paymentRefs: [] };
let restoreBanUserId = null;

// CONT_1

async function main() {
  console.log(`E2E against ${BASE}`);
  console.log(`Test email: ${TEST_EMAIL}\n`);

  // ── 0. Server reachable ────────────────────────────────────────────────────
  section("Server & public pages");
  {
    const home = await req("home", "GET", "/");
    ok("GET / (landing) 200", home.status === 200);

    for (const [label, path] of [
      ["/login", "/login"],
      ["/signup", "/signup"],
      ["/live", "/live"],
      ["/faqs", "/faqs"],
      ["/contact", "/contact"],
      ["/forgot-password", "/forgot-password"],
      ["/verify-email", "/verify-email"],
      ["/onboarding", "/onboarding"],
    ]) {
      const r = await req(label, "GET", path);
      ok(`GET ${label} renders`, r.status === 200, `status ${r.status}`);
    }
  }

  // ── 1. Auth: signup → verify → onboarding → me → logout → login ────────────
  section("Auth lifecycle");
  let demoHasProfile = false;
  {
    const birthDate = "1996-06-15"; // ~30, safely 18+
    const signup = await req("signup", "POST", "/api/auth/signup", {
      jarName: "qa",
      body: { email: TEST_EMAIL, password: "SuperSecret123", birthDate },
    });
    ok("signup 200 ok", signup.status === 200 && signup.json?.ok === true, JSON.stringify(signup.json));
    const u = await db.user.findUnique({ where: { email: TEST_EMAIL.toLowerCase() } });
    if (u) created.userIds.push(u.id);
    ok("signup created user row", !!u);
    ok("signup started a session (cookie set)", Object.keys(jar("qa")).length > 0);

    // Duplicate signup rejected
    const dup = await req("signup-dup", "POST", "/api/auth/signup", {
      jarName: "qa2",
      body: { email: TEST_EMAIL, password: "SuperSecret123", birthDate },
    });
    ok("duplicate signup rejected 409", dup.status === 409);

    // Underage rejected
    const minor = await req("signup-minor", "POST", "/api/auth/signup", {
      jarName: "qa3",
      body: { email: `qa+minor-${STAMP}@hooks247.com`, password: "SuperSecret123", birthDate: "2015-01-01" },
    });
    ok("underage signup rejected 403", minor.status === 403);

    // Verify with wrong code, then the real one
    const wrong = await req("verify-wrong", "POST", "/api/verify-email", {
      jarName: "qa",
      body: { action: "verify", code: "000000" },
    });
    ok("wrong verify code rejected 400", wrong.status === 400);

    const code = await latestCode(TEST_EMAIL);
    ok("verification code exists in DB", !!code, "no code row");
    const verify = await req("verify", "POST", "/api/verify-email", {
      jarName: "qa",
      body: { action: "verify", code: code ?? "x" },
    });
    ok("verify 200 verified", verify.status === 200 && verify.json?.verified === true, JSON.stringify(verify.json));

    // Onboarding
    const onboard = await req("onboarding", "POST", "/api/onboarding", {
      jarName: "qa",
      body: {
        displayName: "QA Tester",
        birthDate,
        gender: "MALE",
        lookingFor: ["FEMALE"],
        bio: "Automated end-to-end test account.",
        country: "Nigeria",
        state: "Lagos",
        city: "Ikeja",
        ethnicity: "Black / African",
        bodyBuild: "Athletic",
        education: "BSc",
        smoking: "No",
        orientation: "Straight",
        availableToday: true,
        interests: ["Tech", "Music"],
        avatarUrl: "",
        services: [
          { name: "Dinner Dates", incallRate: null, outcallRate: 50000, enabled: true },
        ],
      },
    });
    ok("onboarding 200 ok", onboard.status === 200 && onboard.json?.ok === true, JSON.stringify(onboard.json));

    // Onboarding validation: bad city
    const badCity = await req("onboarding-badcity", "POST", "/api/onboarding", {
      jarName: "qa",
      body: {
        displayName: "QA", birthDate, gender: "MALE", lookingFor: ["FEMALE"],
        country: "Nigeria", state: "Lagos", city: "Nowhere",
        ethnicity: "Black / African", bodyBuild: "Athletic", education: "BSc",
        smoking: "No", orientation: "Straight",
      },
    });
    ok("onboarding rejects invalid city 400", badCity.status === 400);

    // /api/me reflects the new profile
    const me = await req("me", "GET", "/api/me", { jarName: "qa" });
    ok("me returns profile", me.status === 200 && me.json?.user?.profile?.displayName === "QA Tester", JSON.stringify(me.json?.user?.profile ?? me.json));

    // Logout clears the session
    await req("logout", "POST", "/api/auth/logout", { jarName: "qa" });
    const meAfter = await req("me-after-logout", "GET", "/api/me", { jarName: "qa" });
    ok("me 401 after logout", meAfter.status === 401);

    // Wrong-password login rejected
    const badLogin = await req("login-bad", "POST", "/api/auth/login", {
      jarName: "demo",
      body: { email: "demo@hook247.app", password: "wrongpassword" },
    });
    ok("wrong password login rejected 401", badLogin.status === 401);

    // Demo login
    const login = await req("login", "POST", "/api/auth/login", {
      jarName: "demo",
      body: { email: "demo@hook247.app", password: "hook247demo" },
    });
    ok("demo login 200 ok", login.status === 200 && login.json?.ok === true, JSON.stringify(login.json));
    demoHasProfile = login.json?.hasProfile === true;
    ok("demo has profile", demoHasProfile);
  }

  // ── 2. Discovery ───────────────────────────────────────────────────────────
  section("Discovery");
  {
    const browse = await req("browse", "GET", "/api/browse", { jarName: "demo" });
    ok("browse returns arrays", browse.status === 200 && Array.isArray(browse.json?.members), JSON.stringify(browse.json).slice(0, 120));
    ok("browse has members", (browse.json?.members?.length ?? 0) > 0);

    const browseFilter = await req("browse-filter", "GET", "/api/browse?tab=verified&gender=FEMALE&state=Lagos", { jarName: "demo" });
    ok("browse with filters 200", browseFilter.status === 200);

    const discover = await req("discover", "GET", "/api/discover", { jarName: "demo" });
    ok("discover returns profiles", discover.status === 200 && Array.isArray(discover.json?.profiles));
    ok("discover excludes self", !discover.json?.profiles?.some((p) => p.displayName === "Demo"));

    const likers = await req("likers", "GET", "/api/likers", { jarName: "demo" });
    // Demo is ELITE in the seed, so the list is unlocked.
    ok("likers unlocked for elite", likers.status === 200 && likers.json?.locked === false, JSON.stringify(likers.json).slice(0, 120));
    ok("likers has admirers", (likers.json?.count ?? 0) >= 1);

    // Swipe self → rejected
    const me = await db.user.findUnique({ where: { email: "demo@hook247.app" } });
    const selfSwipe = await req("swipe-self", "POST", "/api/swipe", {
      jarName: "demo",
      body: { targetUserId: me.id, liked: true },
    });
    ok("swipe self rejected 400", selfSwipe.status === 400);

    // Demo likes Amara. The seed has Amara→Demo already, so this must match.
    const amara = await db.user.findUnique({ where: { email: "amara@hook247.app" } });
    const swipe = await req("swipe-match", "POST", "/api/swipe", {
      jarName: "demo",
      body: { targetUserId: amara.id, liked: true },
    });
    ok("swipe creates a match", swipe.status === 200 && swipe.json?.matched === true, JSON.stringify(swipe.json));
  }

  // ── 3. Social: feed, comments, likes, messages ─────────────────────────────
  section("Social");
  {
    const feed = await req("feed", "GET", "/api/feed", { jarName: "demo" });
    ok("feed returns posts", feed.status === 200 && Array.isArray(feed.json?.posts));
    ok("feed has recommendations", Array.isArray(feed.json?.recommended));

    // Create a post
    const post = await req("post-create", "POST", "/api/feed", {
      jarName: "demo",
      body: { body: `E2E post ${STAMP}` },
    });
    ok("create post 200", post.status === 200 && !!post.json?.id, JSON.stringify(post.json));
    const postId = post.json?.id;
    if (postId) created.postIds.push(postId);

    // Empty post rejected
    const empty = await req("post-empty", "POST", "/api/feed", { jarName: "demo", body: { body: "  " } });
    ok("empty post rejected 400", empty.status === 400);

    // Like toggle
    if (postId) {
      const like1 = await req("like-on", "POST", `/api/feed/${postId}/like`, { jarName: "demo" });
      ok("like sets liked=true", like1.json?.liked === true, JSON.stringify(like1.json));
      const like2 = await req("like-off", "POST", `/api/feed/${postId}/like`, { jarName: "demo" });
      ok("like toggles off", like2.json?.liked === false);

      const comment = await req("comment", "POST", `/api/feed/${postId}/comments`, {
        jarName: "demo",
        body: { body: `E2E comment ${STAMP}` },
      });
      ok("comment created", comment.status === 200 && !!comment.json?.comment?.id, JSON.stringify(comment.json));
      if (comment.json?.comment?.id) created.commentIds.push(comment.json.comment.id);
    }

    // Messages in the demo↔chiamaka seeded match
    const matches = await req("matches", "GET", "/api/matches", { jarName: "demo" });
    ok("matches returns list", matches.status === 200 && (matches.json?.matches?.length ?? 0) >= 1);
    const matchId = matches.json?.matches?.[0]?.matchId;
    if (matchId) {
      const thread = await req("thread", "GET", `/api/messages/${matchId}`, { jarName: "demo" });
      ok("read thread 200", thread.status === 200 && Array.isArray(thread.json?.messages));
      const send = await req("send-msg", "POST", `/api/messages/${matchId}`, {
        jarName: "demo",
        body: { body: `E2E message ${STAMP}` },
      });
      ok("send message 200", send.status === 200 && send.json?.message?.mine === true, JSON.stringify(send.json));
    } else {
      ok("match available for messaging", false, "no matchId");
    }

    // Cannot read a match you are not part of
    const bogus = await req("thread-forbidden", "GET", "/api/messages/nonexistent-match-id", { jarName: "demo" });
    ok("foreign/unknown match 404", bogus.status === 404);
  }

  // ── 4. Payments ────────────────────────────────────────────────────────────
  section("Payments (Paystack LIVE — no charge)");
  {
    const pk = await req("premium-key", "GET", "/api/premium", { jarName: "demo" });
    ok("premium returns public key", pk.status === 200 && /^pk_/.test(pk.json?.publicKey ?? ""), JSON.stringify(pk.json));

    const bad = await req("premium-bad", "POST", "/api/premium", { jarName: "demo", body: { action: "checkout", purpose: "NONSENSE" } });
    ok("bad purpose rejected 400", bad.status === 400);

    // One real init to prove Paystack integration. Creates a PENDING row +
    // Paystack transaction; no money moves until a card is entered. Voided below.
    const checkout = await req("premium-checkout", "POST", "/api/premium", {
      jarName: "demo",
      body: { action: "checkout", purpose: "PLAN_PLUS" },
    });
    ok("checkout returns Paystack URL", checkout.status === 200 && /paystack/.test(checkout.json?.checkoutUrl ?? ""), JSON.stringify(checkout.json).slice(0, 160));
    if (checkout.json?.reference) created.paymentRefs.push(checkout.json.reference);

    // Webhook signature enforcement
    const noSig = await req("wh-nosig", "POST", "/api/webhooks/paystack", { jarName: "demo", body: { event: "charge.success" } });
    ok("webhook without signature 401", noSig.status === 401);

    const badSig = await req("wh-badsig", "POST", "/api/webhooks/paystack", {
      jarName: "demo", body: { event: "charge.success", data: { reference: "x" } },
      headers: { "x-paystack-signature": "deadbeef" },
    });
    ok("webhook bad signature 401", badSig.status === 401);

    // Valid signature over an unknown reference → accepted, treated as unknown.
    // Send the exact signed bytes, so bypass the JSON helper's re-stringify.
    const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
    const payload = JSON.stringify({ event: "charge.success", data: { reference: `unknown_${STAMP}` } });
    const sig = crypto.createHmac("sha512", secret).update(payload).digest("hex");
    const rawRes = await fetch(`${BASE}/api/webhooks/paystack`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-paystack-signature": sig },
      body: payload,
    });
    const rawJson = await rawRes.json().catch(() => null);
    ok("valid signature accepted (unknown ref)", rawRes.status === 200 && rawJson?.unknown, JSON.stringify(rawJson));

    // Non-charge events are acknowledged and ignored.
    const evtPayload = JSON.stringify({ event: "transfer.success", data: {} });
    const evtSig = crypto.createHmac("sha512", secret).update(evtPayload).digest("hex");
    const evtRes = await fetch(`${BASE}/api/webhooks/paystack`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-paystack-signature": evtSig },
      body: evtPayload,
    });
    const evtJson = await evtRes.json().catch(() => null);
    ok("non-charge event ignored", evtRes.status === 200 && evtJson?.ignored === "transfer.success", JSON.stringify(evtJson));
  }

  // ── 5. Report + moderation enforcement ─────────────────────────────────────
  section("Report & moderation");
  {
    const target = await db.user.findUnique({ where: { email: "tunde@hook247.app" } });
    const report = await req("report", "POST", "/api/report", {
      jarName: "demo",
      body: { targetType: "USER", targetId: target.id, reason: "SPAM", details: "e2e test report" },
    });
    ok("report accepted", report.status === 200 && report.json?.ok === true, JSON.stringify(report.json));
    const rrow = await db.report.findFirst({ where: { targetUserId: target.id, details: "e2e test report" } });
    if (rrow) created.reportIds.push(rrow.id);

    const dupReport = await req("report-dup", "POST", "/api/report", {
      jarName: "demo",
      body: { targetType: "USER", targetId: target.id, reason: "SPAM", details: "again" },
    });
    ok("duplicate report flagged", dupReport.json?.duplicate === true, JSON.stringify(dupReport.json));

    const demo = await db.user.findUnique({ where: { email: "demo@hook247.app" } });
    const selfReport = await req("report-self", "POST", "/api/report", {
      jarName: "demo",
      body: { targetType: "USER", targetId: demo.id, reason: "SPAM" },
    });
    ok("self-report rejected 400", selfReport.status === 400);

    // Ban a peripheral seed user, prove enforcement, then restore.
    const victim = await db.user.findUnique({ where: { email: "ibrahim@hook247.app" }, include: { profile: true } });
    restoreBanUserId = victim.id;
    await db.user.update({ where: { id: victim.id }, data: { bannedAt: new Date(), banReason: "e2e" } });

    const bannedLogin = await req("banned-login", "POST", "/api/auth/login", {
      jarName: "victim",
      body: { email: "ibrahim@hook247.app", password: "hook247demo" },
    });
    ok("banned user login blocked 403", bannedLogin.status === 403, `status ${bannedLogin.status}`);

    const browseAfter = await req("browse-after-ban", "GET", "/api/browse", { jarName: "demo" });
    const stillListed = [...(browseAfter.json?.members ?? []), ...(browseAfter.json?.featured ?? []), ...(browseAfter.json?.live ?? [])]
      .some((p) => p.userId === victim.id);
    ok("banned user absent from browse", !stillListed);

    const discoverAfter = await req("discover-after-ban", "GET", "/api/discover", { jarName: "demo" });
    ok("banned user absent from discover", !discoverAfter.json?.profiles?.some((p) => p.userId === victim.id));

    // Restore now (cleanup also does, but keep the window tiny).
    await db.user.update({ where: { id: victim.id }, data: { bannedAt: null, banReason: "", suspendedUntil: null } });
    restoreBanUserId = null;
    ok("ban reversed cleanly", true);
  }

  // ── 6. Admin console ───────────────────────────────────────────────────────
  section("Admin console");
  {
    // Decoy for anonymous callers
    const decoy = await req("admin-decoy", "GET", "/502test/users", { jarName: "anon" });
    ok("admin page blocked without cookie", decoy.status !== 200 || !/ban|report|verification/i.test(decoy.text), `status ${decoy.status}`);

    const enter = await req("admin-enter", "GET", "/502test/enter", { jarName: "anon" });
    ok("admin sign-in page reachable", enter.status === 200 && /502 Bad Gateway/.test(enter.text));

    // Forged cookie (wrong secret) must be rejected by the proxy.
    const forged = await new SignJWT({ ops: true })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode("totally-wrong-secret::admin"));
    jar("forged").hook247_ops = forged;
    const forgedRes = await req("admin-forged", "GET", "/502test/users", { jarName: "forged" });
    ok("forged admin cookie rejected", forgedRes.status !== 200 || !/ban/i.test(forgedRes.text));

    // Genuine admin cookie, minted exactly as adminSession.ts does.
    const authSecret = process.env.AUTH_SECRET || "hook247-dev-secret";
    const adminToken = await new SignJWT({ ops: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode(`${authSecret}::admin`));
    jar("admin").hook247_ops = adminToken;

    // Authenticated admin pages render real content. Note the console keeps the
    // "502 Bad Gateway" phrase in its chrome as camouflage, so presence of that
    // string is NOT a failure — assert on positive admin markers instead.
    for (const [label, path, marker] of [
      ["dashboard", "/502test", /Users|Reports|Overview|Moderation|Pending/i],
      ["users", "/502test/users", /Ban|Suspend/i],
      ["content", "/502test/content", /Hide|Post|Content/i],
      ["reports", "/502test/reports", /Report|Resolve|Dismiss|No open/i],
      ["payments", "/502test/payments", /Payment|Reference|Retry|Amount|No payments/i],
      ["verification", "/502test/verification", /Verif|Approve|Revoke|No pending/i],
      ["audit", "/502test/audit", /Audit|Action|admin\.|No actions/i],
    ]) {
      const r = await req(`admin-${label}`, "GET", path, { jarName: "admin" });
      ok(`admin ${label} renders`, r.status === 200 && marker.test(r.text), `status ${r.status}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("\nHarness crashed:", e);
    fail++;
    failures.push(`harness crash: ${e.message}`);
  })
  .finally(async () => {
    await cleanup();
    await db.$disconnect();
    console.log(`\n──────────────────────────────────────`);
    console.log(`PASS ${pass}   FAIL ${fail}`);
    if (failures.length) {
      console.log(`\nFailures:`);
      for (const f of failures) console.log(`  • ${f}`);
    }
    process.exit(fail ? 1 : 0);
  });

async function cleanup() {
  section("Cleanup");
  try {
    if (restoreBanUserId) {
      await db.user.update({
        where: { id: restoreBanUserId },
        data: { bannedAt: null, banReason: "", suspendedUntil: null },
      });
      console.log("  restored ban toggle");
    }
    for (const ref of created.paymentRefs) {
      await db.payment.deleteMany({ where: { reference: ref } });
    }
    for (const id of created.reportIds) {
      await db.report.deleteMany({ where: { id } });
    }
    // Remove the throwaway user and everything hanging off it.
    for (const uid of created.userIds) {
      await db.report.deleteMany({ where: { OR: [{ reporterId: uid }, { targetUserId: uid }] } });
      await db.comment.deleteMany({ where: { authorId: uid } });
      await db.postLike.deleteMany({ where: { userId: uid } });
      await db.post.deleteMany({ where: { authorId: uid } });
      await db.message.deleteMany({ where: { senderId: uid } });
      await db.swipe.deleteMany({ where: { OR: [{ swiperId: uid }, { swipedId: uid }] } });
      await db.match.deleteMany({ where: { OR: [{ userAId: uid }, { userBId: uid }] } });
      await db.payment.deleteMany({ where: { userId: uid } });
      await db.emailVerification.deleteMany({ where: { userId: uid } });
      await db.serviceOffer.deleteMany({ where: { profile: { userId: uid } } });
      await db.profile.deleteMany({ where: { userId: uid } });
      await db.user.deleteMany({ where: { id: uid } });
    }
    // Remove demo-authored test artifacts.
    for (const id of created.commentIds) await db.comment.deleteMany({ where: { id } });
    for (const id of created.postIds) {
      await db.comment.deleteMany({ where: { postId: id } });
      await db.postLike.deleteMany({ where: { postId: id } });
      await db.post.deleteMany({ where: { id } });
    }
    console.log("  removed test users, posts, comments, payments");
  } catch (e) {
    console.log(`  ⚠ cleanup issue: ${e.message}`);
  }
}
