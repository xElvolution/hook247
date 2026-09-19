# Production Integration Status

## ✅ Completed

### Bugs found and fixed in final review
- **Rate limit never triggered** (`src/lib/verification.ts`) — `issueCode` counted
  recent codes then *deleted* the unused ones, so the count reset to 1 on every
  call and the 5-per-15-min cap could never fire. Old codes are now expired
  rather than deleted: only the newest works, and they still count toward the
  limit.
- **Forgeable sessions** (`src/lib/session.ts`) — `AUTH_SECRET` silently fell back
  to a hardcoded string, so anyone knowing it could mint a valid session cookie.
  Now a hard failure in production.
- **Payment could never activate locally** — the webhook was the only fulfilment
  path, and it needs a public URL. Fulfilment is now shared with the Paystack
  callback (`src/lib/fulfilPayment.ts`), claimed atomically via a conditional
  `updateMany` so a webhook/callback race grants the benefit exactly once.
- **Orphaned PENDING rows** (`src/app/api/premium/route.ts`) — if Paystack init
  threw, the row sat PENDING forever and the client got an opaque 500. Now marked
  FAILED with a 502.
- **Timing-unsafe signature check** (`src/lib/paystack.ts`) — `===` on the HMAC
  replaced with `crypto.timingSafeEqual`.
- **Build-breaking lint** — two `catch (err: any)` blocks would fail
  `@typescript-eslint/no-explicit-any` under `next/typescript`. Narrowed properly,
  and they now distinguish 429 (rate limit) from 502 (mail transport failure).
- **Non-idempotent seed** — post likes used `create` with `Math.random()`, so a
  re-seed was non-deterministic. Now `upsert` with a deterministic spread.

### Backend Infrastructure
- **Database schema** — extended with EmailVerification, Payment models, enums for verification types, payment purposes, and statuses
- **Email integration** — Hostinger SMTP via nodemailer (`src/lib/mailer.ts`)
  - Verification codes (signup, password reset)
  - Match notifications
  - Payment receipts
  - 10-minute code expiry, rate-limited to 5 codes per 15 min per address
- **Payment integration** — Paystack live keys with webhook (`src/lib/paystack.ts`)
  - Signature verification (HMAC-SHA512)
  - Idempotent fulfillment keyed on `reference`
  - Webhook route: `/api/webhooks/paystack`
- **Session auth** — JWT with bcrypt, stored in HTTP-only cookies

### API Routes (Production-Only)
All demo fallbacks removed. Every route reads from Postgres:
- `/api/auth/signup` — creates user, sends verification code
- `/api/auth/login` — checks credentials, returns session
- `/api/verify-email` — send/verify 6-digit codes
- `/api/reset-password` — request/consume password-reset codes
- `/api/premium` — Paystack checkout (POST), public key (GET)
- `/api/webhooks/paystack` — fulfills payments on `charge.success`
- `/api/swipe` — creates matches, sends match emails
- `/api/discover`, `/api/browse`, `/api/feed`, `/api/live` — no demo data

### Pages
- `/verify-email` — 6-digit code entry with resend + skip
- `/forgot-password` — two-step: request code → reset password
- `/premium` — real Paystack checkout (server reads `searchParams` prop to avoid Suspense issues)
- Login page links to `/forgot-password`
- Signup → onboarding → verify-email flow

### Seed
- 12 pre-confirmed users with services, live status, boosted/verified flags
- Demo account: `demo@hook247.app` / `hook247demo`
- State/city fields populated from `LOCATION_DATA` constants

### Configuration
- `.env` — documented with Neon pooler note, Hostinger SMTP, Paystack live keys
- `.env.example` — template for deployment
- `README.md` — setup guide, pricing table, deployment checklist

## ⏳ Pending (User Action Required)

### 1. Email — configured and verified ✅
`support@hooks247.com` (Hostinger SMTP, port 465) is wired into `.env` and a live
send test was accepted for delivery. This covers signup verification codes,
password reset, match notifications, and payment receipts.

Note: the sending domain is **hooks247.com** (with the `s`). The bare
`hook247.com` has a null MX and `v=spf1 -all`, so it can neither send nor receive
mail — do not use it as `EMAIL_FROM`. Before launch, add SPF/DKIM/DMARC records
for hooks247.com in DNS so mail lands in inboxes rather than spam.

### 2. Rotate the Neon password
The `DATABASE_URL` password was pasted in plaintext into a terminal session and
this transcript. Rotate it in Neon Dashboard → Roles → Reset password before
launch, and update `.env`.

### 3. Set a real AUTH_SECRET
`.env` still holds the placeholder. Production now hard-fails without a real
one, so generate it before deploying:
```bash
openssl rand -base64 32
```

### 4. Database credentials — done
`DATABASE_URL` is populated with the Neon pooled host and verified working.

## 🔍 Verification Results

**Schema + seed — done.** `prisma generate` → `tsc --noEmit` clean →
`db:push` (24.8s; the pooler accepted the DDL, so no unpooled swap was needed) →
`db:seed`. Seeded: 12 users / 12 profiles / 3 live / 6 verified / 2 boosted /
9 services / 7 posts / 32 likes / 2 comments / 5 swipes / 1 match / 3 messages.
A second seed run produced identical counts, confirming the idempotency fix.

**App against the real DB — done.** No `demoMode` / `demoProfiles` references
remain anywhere in `src/`. Against live Neon:
- `/api/browse` returns real rows (featured 7 / live 3 / members 12);
  `/api/discover`, `/api/me`, `/api/likes` all serve DB data
- Login as `demo@hook247.app` succeeds; a wrong password returns 401
- Every page returns 200: `/`, `/live`, `/live/<live-user>`, `/feed`,
  `/discover`, `/premium`, `/matches`, `/matches/<id>`, `/likes`, `/profile`,
  `/profiles/<id>`, `/onboarding`, `/verify-email`, `/forgot-password`,
  `/faqs`, `/contact`
- `/live/<user-who-is-not-live>` correctly 404s (guarded on `isLive`)
- Live Paystack returned a real checkout URL
- The webhook rejects forged and missing signatures with 401
- The verification rate limiter fires on request 6 (5× 502, then 429)
- Dev log is free of errors and warnings

Note: the homepage shows no seeded names in raw HTML because
`src/components/home/HomeBrowse.tsx` fetches `/api/browse` client-side in a
`useEffect` — that is rendering, not a data problem.

**Landing → app — done.** Landing on :3003 serves the correct cross-links:
`http://localhost:3001/login`, `/signup`, and two bare `http://localhost:3001`
CTAs, all driven by `NEXT_PUBLIC_APP_URL` in `landing/.env.local`. All three
targets return 200 on the app. `npm run build` passes for both projects
(app: 38 routes; landing: 2 static routes).

There is no `/messages` route — chat lives at `/matches/[matchId]`.

## 🚀 Before Launch

- [ ] Provide `EMAIL_PASSWORD` (the only thing still blocking a feature)
- [ ] Rotate the Neon password and set a real `AUTH_SECRET`
- [ ] Register webhook in Paystack dashboard: `<NEXT_PUBLIC_APP_URL>/api/webhooks/paystack`
- [ ] Expose webhook endpoint (ngrok/Cloudflare Tunnel for local testing, or deploy)
- [ ] Set production `NEXT_PUBLIC_APP_URL` so payment callbacks and email links resolve
- [ ] Move uploads off ephemeral local disk (S3/Cloudinary) — they vanish on redeploy
- [ ] Clear 4 remaining npm advisories (next, postcss, sharp, brace-expansion).
      Left alone deliberately: the fix installs `next@16.3.0`, outside the
      dependency range this project was built and verified against.
- [ ] Replace paid `VERIFICATION` with real ID check (currently sets badge directly)
- [ ] Enable content moderation (report/block, image screening)
- [ ] Swap chat polling for WebSockets (Pusher/Ably)

## Known Limitations

- **Live streaming** — viewer UI exists but no media server is wired
- **Chat** — 4s polling, not realtime
- **Verification** — paying ₦2,000 sets the badge; no ID/selfie check yet

## Files Changed (This Session)

**Bug fixes:**
- `src/lib/verification.ts` — rate-limit now works (expire old codes instead of deleting them)
- `src/lib/session.ts` — AUTH_SECRET hard failure in production
- `src/lib/paystack.ts` — hard failure in production if keys missing, timing-safe signature comparison
- `src/app/api/premium/route.ts` — catch Paystack init failures, mark FAILED
- `src/app/api/verify-email/route.ts` — removed `any`, distinguish 429/502
- `src/app/api/reset-password/route.ts` — removed `any`, distinguish 429/502
- `src/app/api/webhooks/paystack/route.ts` — delegated to shared fulfilment
- `src/app/(authed)/premium/page.tsx` — completes payment on callback
- `src/components/PremiumPlans.tsx` — added `paymentComplete` prop
- `prisma/seed.ts` — idempotent post likes with deterministic spread
- `README.md` — documented AUTH_SECRET requirement, callback fulfilment, upload caveat

**New files:**
- `src/lib/fulfilPayment.ts` — idempotent payment fulfilment shared by webhook + callback
- `src/lib/publicProfile.ts` — extracted from deleted demoProfiles
- `src/lib/mailer.ts`, `src/lib/paystack.ts`, `src/lib/verification.ts` — (from previous session)
- `src/app/verify-email/page.tsx`, `src/app/forgot-password/page.tsx` — (from previous session)

**Deleted:**
- `src/lib/demoProfiles.ts` — removed all demo fallbacks
