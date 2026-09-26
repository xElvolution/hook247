-- Coins v2: fixed N50 coins, gift split into a naira earnings wallet, saved
-- withdrawal accounts, a platform ledger and withdrawal fees.
-- Purely additive and safe to run more than once:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/sql/coins-v2.sql
-- (prisma db push would do the same, but this file never drops anything that
-- another branch may have added to the database.)

DO $$ BEGIN
  CREATE TYPE "EarningsTxType" AS ENUM ('GIFT_SHARE', 'LEGACY_CONVERSION', 'WITHDRAWAL_HOLD', 'WITHDRAWAL_PAID', 'WITHDRAWAL_RELEASE', 'ADMIN_ADJUST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "LedgerKind" AS ENUM ('GIFT', 'PURCHASE', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_PAID', 'WITHDRAWAL_REJECTED', 'LEGACY_CONVERSION', 'ADMIN_ADJUST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "LedgerStatus" AS ENUM ('COMPLETED', 'PENDING', 'FAILED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "CoinTxType" ADD VALUE IF NOT EXISTS 'GIFT_SENT';
ALTER TYPE "CoinTxType" ADD VALUE IF NOT EXISTS 'LEGACY_CONVERSION';

ALTER TABLE "CoinSettings"
  ADD COLUMN IF NOT EXISTS "coinPriceKobo" INTEGER NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS "escortSharePct" INTEGER NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS "legacyConvertedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "manualWithdrawalApproval" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "withdrawalFeeBps" INTEGER NOT NULL DEFAULT 200;

ALTER TABLE "CoinWithdrawal"
  ADD COLUMN IF NOT EXISTS "accountId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "feeBps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "feeKobo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grossKobo" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'coins';

ALTER TABLE "LiveGift"
  ADD COLUMN IF NOT EXISTS "animation" TEXT NOT NULL DEFAULT 'float',
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "giftingDisabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "payoutsFrozen" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "EarningsWallet" (
    "userId" TEXT NOT NULL,
    "balanceKobo" INTEGER NOT NULL DEFAULT 0,
    "heldKobo" INTEGER NOT NULL DEFAULT 0,
    "lifetimeKobo" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EarningsWallet_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "EarningsTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EarningsTxType" NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "heldKobo" INTEGER NOT NULL DEFAULT 0,
    "balanceAfterKobo" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "ledgerEntryId" TEXT,
    "withdrawalId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EarningsTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LedgerEntry" (
    "id" TEXT NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'COMPLETED',
    "idempotencyKey" TEXT NOT NULL,
    "senderId" TEXT,
    "receiverId" TEXT,
    "giftId" TEXT,
    "giftName" TEXT NOT NULL DEFAULT '',
    "giftEmoji" TEXT NOT NULL DEFAULT '',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "coinPriceKobo" INTEGER NOT NULL DEFAULT 0,
    "amountKobo" INTEGER NOT NULL DEFAULT 0,
    "escortSharePct" INTEGER NOT NULL DEFAULT 0,
    "escortShareKobo" INTEGER NOT NULL DEFAULT 0,
    "platformShareKobo" INTEGER NOT NULL DEFAULT 0,
    "feeKobo" INTEGER NOT NULL DEFAULT 0,
    "payoutKobo" INTEGER NOT NULL DEFAULT 0,
    "liveSessionId" TEXT,
    "postId" TEXT,
    "purchaseId" TEXT,
    "withdrawalId" TEXT,
    "source" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WithdrawalAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "recipientCode" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WithdrawalAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EarningsTransaction_idempotencyKey_key" ON "EarningsTransaction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EarningsTransaction_userId_createdAt_idx" ON "EarningsTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EarningsTransaction_type_createdAt_idx" ON "EarningsTransaction"("type", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "LedgerEntry_kind_createdAt_idx" ON "LedgerEntry"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "LedgerEntry_senderId_createdAt_idx" ON "LedgerEntry"("senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "LedgerEntry_receiverId_createdAt_idx" ON "LedgerEntry"("receiverId", "createdAt");
CREATE INDEX IF NOT EXISTS "LedgerEntry_liveSessionId_idx" ON "LedgerEntry"("liveSessionId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_withdrawalId_idx" ON "LedgerEntry"("withdrawalId");
CREATE INDEX IF NOT EXISTS "WithdrawalAccount_userId_idx" ON "WithdrawalAccount"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "WithdrawalAccount_userId_bankCode_accountNumber_key" ON "WithdrawalAccount"("userId", "bankCode", "accountNumber");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EarningsWallet_userId_fkey') THEN
    ALTER TABLE "EarningsWallet" ADD CONSTRAINT "EarningsWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EarningsTransaction_userId_fkey') THEN
    ALTER TABLE "EarningsTransaction" ADD CONSTRAINT "EarningsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WithdrawalAccount_userId_fkey') THEN
    ALTER TABLE "WithdrawalAccount" ADD CONSTRAINT "WithdrawalAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Balances can never go negative, whatever the application does.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EarningsWallet_balance_nonnegative') THEN
    ALTER TABLE "EarningsWallet" ADD CONSTRAINT "EarningsWallet_balance_nonnegative" CHECK ("balanceKobo" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EarningsWallet_held_nonnegative') THEN
    ALTER TABLE "EarningsWallet" ADD CONSTRAINT "EarningsWallet_held_nonnegative" CHECK ("heldKobo" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoinSettings_split_range') THEN
    ALTER TABLE "CoinSettings" ADD CONSTRAINT "CoinSettings_split_range" CHECK ("escortSharePct" BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoinSettings_fee_range') THEN
    ALTER TABLE "CoinSettings" ADD CONSTRAINT "CoinSettings_fee_range" CHECK ("withdrawalFeeBps" BETWEEN 0 AND 5000);
  END IF;
END $$;

-- Only one open withdrawal per member at a time, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS "CoinWithdrawal_one_open_per_user"
  ON "CoinWithdrawal" ("userId") WHERE "status" IN ('REQUESTED', 'APPROVED');

-- The earnings ledger and the platform ledger are append-only.
CREATE OR REPLACE FUNCTION ledger_row_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS earnings_transaction_no_update ON "EarningsTransaction";
CREATE TRIGGER earnings_transaction_no_update
  BEFORE UPDATE OR DELETE ON "EarningsTransaction"
  FOR EACH ROW EXECUTE FUNCTION ledger_row_immutable();

DROP TRIGGER IF EXISTS ledger_entry_no_update ON "LedgerEntry";
CREATE TRIGGER ledger_entry_no_update
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_row_immutable();
