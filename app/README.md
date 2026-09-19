# Hook247 — Dating that never sleeps 🔥

A full-stack dating platform built with Next.js 16, Prisma + Neon Postgres,
Framer Motion and GSAP.

**Features**

- GSAP-animated landing page (character-reveal hero, floating profile cards, scroll-triggered sections, stat counters, marquee)
- Email/password auth with an enforced 18+ age gate (server-side)
- Email confirmation and password reset via 6-digit codes over Hostinger SMTP
- 3-step animated onboarding (identity, preferences, bio/interests/avatar)
- Swipe deck with real drag physics (Framer Motion), LIKE/PASS stamps and a match-celebration modal
- Mutual-like matching + 1:1 chat (polling), with match notification emails
- **The Feed** — post your vibe, fire-react with burst animation, comment
- "Who likes you" — free users see the count, premium sees the people
- Premium plans (Plus / Elite), profile **Boost** and **Verified** badge, billed
  through Paystack checkout with a signature-verified webhook
- Dark glassmorphic design system, mobile bottom-tabs + desktop sidebar

There is no demo/offline mode: every screen reads from Postgres, so the database
must be reachable for the app to render.

## Setup

Copy `.env.example` to `.env` and fill in the values below.

1. **Database** — create a free Postgres at [neon.tech](https://neon.tech), copy the
   connection string (use the `-pooler` host), and set:

   ```
   DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
   ```

2. **Sessions** — set a strong random `AUTH_SECRET` (e.g. `openssl rand -base64 32`).
   Rotating it invalidates every existing session. Missing this in production is a
   hard failure — a known fallback secret means anyone can forge a session cookie.

3. **Email (Hostinger SMTP)** — from hPanel → Emails → the `support@hooks247.com`
   mailbox:

   ```
   EMAIL_HOST="smtp.hostinger.com"
   EMAIL_PORT="465"          # 465 = implicit TLS, 587 = STARTTLS
   EMAIL_USER="support@hooks247.com"
   EMAIL_PASSWORD="<mailbox password>"
   EMAIL_FROM="support@hooks247.com"
   ```

   Mail failures are surfaced, never swallowed — a signup that never receives its
   code is a dead account.

4. **Payments (Paystack)** — set `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`,
   then register the webhook in the Paystack dashboard
   (Settings → API Keys & Webhooks):

   ```
   <NEXT_PUBLIC_APP_URL>/api/webhooks/paystack
   ```

   The webhook must be reachable from the internet — for local testing expose it
   with a tunnel (`ngrok http 3001`) and use the tunnel URL.

   Purchases also complete from the Paystack callback when the browser lands
   back on `/premium`, so checkout still works locally without a tunnel.
   Fulfilment is idempotent and claims the row atomically, so whichever of the
   two paths arrives second is a no-op — a benefit is never granted twice.

5. **Push schema + seed**

   ```bash
   npm run db:push
   npm run db:seed
   ```

6. **Run**

   ```bash
   npm run dev        # app on :3001
   ```

   The marketing site lives in `../landing` (`npm run dev` → :3003) and links
   here via its own `NEXT_PUBLIC_APP_URL`.

## Pricing

| Purpose        | Amount |
| -------------- | ------ |
| `PLAN_PLUS`    | ₦2,500 |
| `PLAN_ELITE`   | ₦6,000 |
| `BOOST`        | ₦1,500 |
| `VERIFICATION` | ₦2,000 |

Amounts are stored in kobo in `src/app/api/premium/route.ts`. Fulfilment happens
in the webhook, keyed on the Paystack `reference`, so a replayed event cannot
grant a benefit twice.

## Seeded accounts

The seed creates 12 members, all pre-confirmed, password `hook247demo`.

- `demo@hook247.app` — Elite plan, verified, 3 pending likes and 1 match with
  chat history. Log in as this one to see everything working.
- Or log in as `amara@hook247.app`, `emeka@hook247.app`, … to chat from the
  other side.

Seeded accounts are ordinary rows; delete them before going live.

## Before launch

- Replace the paid `VERIFICATION` purchase with a real ID/selfie check — today
  paying sets the badge directly.
- Move uploads off local disk. `/api/upload` writes to `public/uploads`, which
  is ephemeral on serverless hosts (Vercel included) — uploaded photos vanish on
  the next deploy. Swap in S3, Cloudinary, or Vercel Blob before launch.
- Uploads are currently unscreened. Anything user-submitted needs moderation and
  a size/content check before it is served to other members.
- Chat uses 4s polling; swap in Pusher/Ably or WebSockets for realtime.
- Live streaming is a viewer UI only; no media server is wired up.
- Content moderation (report/block, image screening) is a must before launch.
- Set `NEXT_PUBLIC_APP_URL` to the real domain so payment callbacks and email
  links resolve.
