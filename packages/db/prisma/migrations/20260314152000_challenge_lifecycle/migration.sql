ALTER TABLE "TradingAccount"
ADD COLUMN "currentPhase" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "phaseStartBalance" DECIMAL(12,2),
ADD COLUMN "phaseStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "reviewQueuedAt" TIMESTAMP(3),
ADD COLUMN "passedAt" TIMESTAMP(3),
ADD COLUMN "fundedAt" TIMESTAMP(3),
ADD COLUMN "breachedAt" TIMESTAMP(3),
ADD COLUMN "lastEvaluatedAt" TIMESTAMP(3);

UPDATE "TradingAccount"
SET "phaseStartBalance" = "startingBalance"
WHERE "phaseStartBalance" IS NULL;

ALTER TABLE "TradingAccount"
ALTER COLUMN "phaseStartBalance" SET NOT NULL;
