ALTER TABLE "DemoAccount"
ADD COLUMN "tradingAccountId" TEXT;

CREATE UNIQUE INDEX "DemoAccount_tradingAccountId_key" ON "DemoAccount"("tradingAccountId");

ALTER TABLE "DemoAccount"
ADD CONSTRAINT "DemoAccount_tradingAccountId_fkey"
FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
