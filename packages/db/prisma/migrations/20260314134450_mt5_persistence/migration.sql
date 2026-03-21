-- CreateTable
CREATE TABLE "Mt5SyncRun" (
    "id" TEXT NOT NULL,
    "tradingAccountId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "balance" DECIMAL(12,2) NOT NULL,
    "equity" DECIMAL(12,2) NOT NULL,
    "realizedPnl" DECIMAL(12,2) NOT NULL,
    "unrealizedPnl" DECIMAL(12,2) NOT NULL,
    "dailyLossUsed" DECIMAL(12,2) NOT NULL,
    "totalLossUsed" DECIMAL(12,2) NOT NULL,
    "tradingDays" INTEGER NOT NULL,
    "rawPayload" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mt5SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mt5PositionSnapshot" (
    "id" TEXT NOT NULL,
    "tradingAccountId" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "lots" DECIMAL(10,2) NOT NULL,
    "openPrice" DECIMAL(18,6) NOT NULL,
    "markPrice" DECIMAL(18,6) NOT NULL,
    "unrealizedPnl" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mt5PositionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mt5ClosedTrade" (
    "id" TEXT NOT NULL,
    "tradingAccountId" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "lots" DECIMAL(10,2) NOT NULL,
    "openPrice" DECIMAL(18,6) NOT NULL,
    "closePrice" DECIMAL(18,6) NOT NULL,
    "realizedPnl" DECIMAL(12,2) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mt5ClosedTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mt5SyncRun_tradingAccountId_syncedAt_idx" ON "Mt5SyncRun"("tradingAccountId", "syncedAt");

-- CreateIndex
CREATE INDEX "Mt5PositionSnapshot_tradingAccountId_createdAt_idx" ON "Mt5PositionSnapshot"("tradingAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mt5PositionSnapshot_syncRunId_ticket_key" ON "Mt5PositionSnapshot"("syncRunId", "ticket");

-- CreateIndex
CREATE INDEX "Mt5ClosedTrade_tradingAccountId_closedAt_idx" ON "Mt5ClosedTrade"("tradingAccountId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mt5ClosedTrade_tradingAccountId_ticket_key" ON "Mt5ClosedTrade"("tradingAccountId", "ticket");

-- AddForeignKey
ALTER TABLE "Mt5SyncRun" ADD CONSTRAINT "Mt5SyncRun_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mt5PositionSnapshot" ADD CONSTRAINT "Mt5PositionSnapshot_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mt5PositionSnapshot" ADD CONSTRAINT "Mt5PositionSnapshot_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "Mt5SyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mt5ClosedTrade" ADD CONSTRAINT "Mt5ClosedTrade_tradingAccountId_fkey" FOREIGN KEY ("tradingAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mt5ClosedTrade" ADD CONSTRAINT "Mt5ClosedTrade_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "Mt5SyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
