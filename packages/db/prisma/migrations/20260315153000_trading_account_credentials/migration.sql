ALTER TABLE "TradingAccount"
ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'MetaTrader 5',
ADD COLUMN "connection" TEXT NOT NULL DEFAULT 'FundedPro-Demo',
ADD COLUMN "tradingPassword" TEXT,
ADD COLUMN "credentialsIssuedAt" TIMESTAMP(3);

UPDATE "TradingAccount"
SET
  "tradingPassword" = COALESCE("tradingPassword", 'FundedPro123!'),
  "credentialsIssuedAt" = COALESCE("credentialsIssuedAt", NOW())
WHERE "tradingPassword" IS NULL;
