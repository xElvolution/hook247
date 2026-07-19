# Hook247 — Dating that never sleeps 🔥

A full-stack dating platform built with Next.js 16, Prisma + Neon Postgres,
Framer Motion and GSAP.

**Features**

- GSAP-animated landing page (character-reveal hero, floating profile cards, scroll-triggered sections, stat counters, marquee)
- Email/password auth with an enforced 18+ age gate (server-side)
- 3-step animated onboarding (identity, preferences, bio/interests/avatar)
- Swipe deck with real drag physics (Framer Motion), LIKE/PASS stamps and a match-celebration modal
- Mutual-like matching + 1:1 chat (polling)
- **The Feed** — post your vibe, fire-react with burst animation, comment
- "Who likes you" — free users see the count, premium sees the people
- Premium plans (Plus / Elite), profile **Boost** (jumps the deck queue) and **Verified** badge — billing is stubbed, ready for Paystack/Stripe
- Dark glassmorphic design system, mobile bottom-tabs + desktop sidebar

## Setup

1. **Database** — create a free Postgres at [neon.tech](https://neon.tech), copy the
   connection string, and paste it into `.env`:

   ```
   DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
   ```

2. **Push schema + seed demo data**

   ```bash
   npm run db:push
   npm run db:seed
   ```

3. **Run**

   ```bash
   npm run dev
   ```

## Demo accounts

The seed creates 12 members. All use password `hook247demo`.

- `demo@hook247.app` — Elite plan, verified, has 3 pending likes and 1 match
  with chat history. Log in as this one to see everything working.
- Or log in as `amara@hook247.app`, `emeka@hook247.app`, … to chat from the
  other side.

## Production notes

- Replace the `/api/premium` stub with a real Paystack/Stripe checkout + webhook.
- Replace the `verify` action with a real ID/selfie verification provider.
- Chat uses 4s polling; swap in Pusher/Ably or WebSockets for realtime.
- Set a strong `AUTH_SECRET` in production.
- Content moderation (report/block, image screening) is a must before launch.
