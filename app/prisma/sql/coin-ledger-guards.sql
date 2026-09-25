-- Database-level guards for the coin wallet. Prisma's schema cannot express
-- these, so apply this file after `prisma db push`:
--   npx prisma db execute --file prisma/sql/coin-ledger-guards.sql --schema prisma/schema.prisma
-- Safe to run more than once.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoinWallet_balance_nonnegative') THEN
    ALTER TABLE "CoinWallet" ADD CONSTRAINT "CoinWallet_balance_nonnegative" CHECK ("balance" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoinWallet_held_nonnegative') THEN
    ALTER TABLE "CoinWallet" ADD CONSTRAINT "CoinWallet_held_nonnegative" CHECK ("held" >= 0);
  END IF;
END $$;

-- The ledger is append-only: any UPDATE or DELETE is refused.
CREATE OR REPLACE FUNCTION coin_transaction_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CoinTransaction rows are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coin_transaction_no_update ON "CoinTransaction";
CREATE TRIGGER coin_transaction_no_update
  BEFORE UPDATE OR DELETE ON "CoinTransaction"
  FOR EACH ROW EXECUTE FUNCTION coin_transaction_immutable();
