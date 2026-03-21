ALTER TABLE "TradingAccount"
ADD COLUMN "challengeOrderId" TEXT;

CREATE UNIQUE INDEX "TradingAccount_challengeOrderId_key" ON "TradingAccount"("challengeOrderId");
