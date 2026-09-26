-- Follows and message requests. Purely additive and safe to run more than once:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/sql/follows-and-requests.sql

DO $$ BEGIN
  CREATE TYPE "MatchStatus" AS ENUM ('ACCEPTED', 'PENDING', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Every existing conversation stays exactly as it is: ACCEPTED.
ALTER TABLE "Match"
  ADD COLUMN IF NOT EXISTS "status" "MatchStatus" NOT NULL DEFAULT 'ACCEPTED',
  ADD COLUMN IF NOT EXISTS "requestedById" TEXT,
  ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");
CREATE INDEX IF NOT EXISTS "Follow_followingId_createdAt_idx" ON "Follow"("followingId", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followerId_fkey') THEN
    ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followingId_fkey') THEN
    ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_not_self') THEN
    ALTER TABLE "Follow" ADD CONSTRAINT "Follow_not_self" CHECK ("followerId" <> "followingId");
  END IF;
END $$;

-- Likes from the old swipe deck become follows, marked as already seen so
-- nobody gets a burst of stale "new follower" badges.
INSERT INTO "Follow" ("id", "followerId", "followingId", "createdAt", "seenAt")
SELECT 'fl' || md5(s."swiperId" || ':' || s."swipedId"), s."swiperId", s."swipedId", s."createdAt", NOW()
FROM "Swipe" s
WHERE s."liked" = true AND s."swiperId" <> s."swipedId"
ON CONFLICT ("followerId", "followingId") DO NOTHING;
