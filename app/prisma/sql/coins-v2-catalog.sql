-- Coins v2 catalogue: 1 coin = N50 with no pack discounts, and the nine gifts.
-- Run once when switching to v2; safe to run again (it only converges the
-- catalogue on these values):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/sql/coins-v2-catalog.sql
-- Purchases keep their own coins and amount, so replacing packs never changes
-- what anyone bought. Gifts that already appear in the ledger are soft
-- deleted rather than removed.

BEGIN;

UPDATE "CoinSettings" SET "coinPriceKobo" = 5000, "updatedAt" = NOW() WHERE "id" = 'default';

DELETE FROM "CoinPack" WHERE "name" NOT IN ('Starter', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Royal', 'VIP');

INSERT INTO "CoinPack" ("id", "name", "coins", "priceKobo", "active", "sortOrder", "createdAt")
SELECT v.id, v.name, v.coins, v.coins * 5000, true, v.sort, NOW()
FROM (VALUES
  ('pack_v2_starter',  'Starter',    20, 1),
  ('pack_v2_bronze',   'Bronze',     50, 2),
  ('pack_v2_silver',   'Silver',    100, 3),
  ('pack_v2_gold',     'Gold',      250, 4),
  ('pack_v2_platinum', 'Platinum',  500, 5),
  ('pack_v2_diamond',  'Diamond',  1000, 6),
  ('pack_v2_royal',    'Royal',    1500, 7),
  ('pack_v2_vip',      'VIP',      2000, 8)
) AS v(id, name, coins, sort)
WHERE NOT EXISTS (SELECT 1 FROM "CoinPack" p WHERE p."name" = v.name);

UPDATE "CoinPack" p SET "coins" = v.coins, "priceKobo" = v.coins * 5000, "sortOrder" = v.sort, "active" = true
FROM (VALUES
  ('Starter', 20, 1), ('Bronze', 50, 2), ('Silver', 100, 3), ('Gold', 250, 4),
  ('Platinum', 500, 5), ('Diamond', 1000, 6), ('Royal', 1500, 7), ('VIP', 2000, 8)
) AS v(name, coins, sort)
WHERE p."name" = v.name;

-- Gifts: update the ones that already exist by name, add the rest.
UPDATE "LiveGift" g SET "emoji" = v.emoji, "coins" = v.coins, "sortOrder" = v.sort, "animation" = v.anim,
  "active" = true, "deletedAt" = NULL, "updatedAt" = NOW()
FROM (VALUES
  ('Rose', '🌹', 1, 1, 'float'), ('Kiss', '💋', 5, 2, 'float'), ('Heart', '💖', 10, 3, 'pulse'),
  ('Love', '💕', 20, 4, 'pulse'), ('Diamond', '💎', 50, 5, 'burst'), ('Crown', '👑', 100, 6, 'burst'),
  ('VIP Gift', '🥂', 500, 7, 'spotlight'), ('Luxury Gift', '🏎️', 1000, 8, 'spotlight'), ('Royal Gift', '🏰', 2000, 9, 'royal')
) AS v(name, emoji, coins, sort, anim)
WHERE g."name" = v.name;

INSERT INTO "LiveGift" ("id", "name", "emoji", "coins", "sortOrder", "active", "animation", "createdAt", "updatedAt")
SELECT 'gift_v2_' || lower(replace(v.name, ' ', '_')), v.name, v.emoji, v.coins, v.sort, true, v.anim, NOW(), NOW()
FROM (VALUES
  ('Rose', '🌹', 1, 1, 'float'), ('Kiss', '💋', 5, 2, 'float'), ('Heart', '💖', 10, 3, 'pulse'),
  ('Love', '💕', 20, 4, 'pulse'), ('Diamond', '💎', 50, 5, 'burst'), ('Crown', '👑', 100, 6, 'burst'),
  ('VIP Gift', '🥂', 500, 7, 'spotlight'), ('Luxury Gift', '🏎️', 1000, 8, 'spotlight'), ('Royal Gift', '🏰', 2000, 9, 'royal')
) AS v(name, emoji, coins, sort, anim)
WHERE NOT EXISTS (SELECT 1 FROM "LiveGift" g WHERE g."name" = v.name);

-- Anything else leaves the catalogue. It stays in the table for the ledger.
UPDATE "LiveGift" SET "active" = false, "deletedAt" = COALESCE("deletedAt", NOW()), "updatedAt" = NOW()
WHERE "name" NOT IN ('Rose', 'Kiss', 'Heart', 'Love', 'Diamond', 'Crown', 'VIP Gift', 'Luxury Gift', 'Royal Gift');

COMMIT;
