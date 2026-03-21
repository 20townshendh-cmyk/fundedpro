-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeDemoAccountId" TEXT;

-- CreateEnum
CREATE TYPE "DemoAccountStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "AssetClass" AS ENUM ('FUTURES', 'CRYPTO');
CREATE TYPE "DemoOrderSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "DemoOrderType" AS ENUM ('MARKET', 'LIMIT');
CREATE TYPE "DemoOrderStatus" AS ENUM ('WORKING', 'FILLED', 'CANCELED', 'REJECTED');
CREATE TYPE "PositionSide" AS ENUM ('LONG', 'SHORT');

-- CreateTable
CREATE TABLE "DemoAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "startingBalance" DECIMAL(12,2) NOT NULL,
    "currentBalance" DECIMAL(12,2) NOT NULL,
    "buyingPower" DECIMAL(12,2) NOT NULL,
    "equity" DECIMAL(12,2) NOT NULL,
    "realizedPnl" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unrealizedPnl" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "status" "DemoAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "tickSize" DECIMAL(18,6) NOT NULL,
    "tickValue" DECIMAL(12,2) NOT NULL,
    "defaultPrice" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTick" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "changeAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "changePct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'simulated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "demoAccountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "side" "DemoOrderSide" NOT NULL,
    "type" "DemoOrderType" NOT NULL,
    "status" "DemoOrderStatus" NOT NULL DEFAULT 'WORKING',
    "quantity" INTEGER NOT NULL,
    "limitPrice" DECIMAL(18,6),
    "submittedPrice" DECIMAL(18,6),
    "averageFillPrice" DECIMAL(18,6),
    "filledQuantity" INTEGER NOT NULL DEFAULT 0,
    "remainingQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filledAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoFill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "demoAccountId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "side" "DemoOrderSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "realizedPnl" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "filledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoFill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "demoAccountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "side" "PositionSide" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "averageEntryPrice" DECIMAL(18,6) NOT NULL,
    "lastPrice" DECIMAL(18,6) NOT NULL,
    "realizedPnl" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unrealizedPnl" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "demoAccountId" TEXT,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "demoAccountId" TEXT NOT NULL,
    "orderId" TEXT,
    "fillId" TEXT,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoAccount_userId_updatedAt_idx" ON "DemoAccount"("userId", "updatedAt");
CREATE UNIQUE INDEX "Instrument_symbol_key" ON "Instrument"("symbol");
CREATE INDEX "PriceTick_instrumentId_createdAt_idx" ON "PriceTick"("instrumentId", "createdAt");
CREATE INDEX "DemoOrder_demoAccountId_status_createdAt_idx" ON "DemoOrder"("demoAccountId", "status", "createdAt");
CREATE INDEX "DemoOrder_instrumentId_status_createdAt_idx" ON "DemoOrder"("instrumentId", "status", "createdAt");
CREATE INDEX "DemoFill_demoAccountId_filledAt_idx" ON "DemoFill"("demoAccountId", "filledAt");
CREATE INDEX "DemoFill_orderId_filledAt_idx" ON "DemoFill"("orderId", "filledAt");
CREATE UNIQUE INDEX "DemoPosition_demoAccountId_instrumentId_key" ON "DemoPosition"("demoAccountId", "instrumentId");
CREATE INDEX "DemoPosition_userId_updatedAt_idx" ON "DemoPosition"("userId", "updatedAt");
CREATE INDEX "Watchlist_userId_updatedAt_idx" ON "Watchlist"("userId", "updatedAt");
CREATE UNIQUE INDEX "WatchlistItem_watchlistId_instrumentId_key" ON "WatchlistItem"("watchlistId", "instrumentId");
CREATE INDEX "WatchlistItem_watchlistId_sortOrder_idx" ON "WatchlistItem"("watchlistId", "sortOrder");
CREATE INDEX "AccountActivityLog_demoAccountId_createdAt_idx" ON "AccountActivityLog"("demoAccountId", "createdAt");
CREATE INDEX "AccountActivityLog_userId_createdAt_idx" ON "AccountActivityLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeDemoAccountId_fkey" FOREIGN KEY ("activeDemoAccountId") REFERENCES "DemoAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DemoAccount" ADD CONSTRAINT "DemoAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PriceTick" ADD CONSTRAINT "PriceTick_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoOrder" ADD CONSTRAINT "DemoOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoOrder" ADD CONSTRAINT "DemoOrder_demoAccountId_fkey" FOREIGN KEY ("demoAccountId") REFERENCES "DemoAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoOrder" ADD CONSTRAINT "DemoOrder_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoFill" ADD CONSTRAINT "DemoFill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoFill" ADD CONSTRAINT "DemoFill_demoAccountId_fkey" FOREIGN KEY ("demoAccountId") REFERENCES "DemoAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoFill" ADD CONSTRAINT "DemoFill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DemoOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoFill" ADD CONSTRAINT "DemoFill_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoPosition" ADD CONSTRAINT "DemoPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoPosition" ADD CONSTRAINT "DemoPosition_demoAccountId_fkey" FOREIGN KEY ("demoAccountId") REFERENCES "DemoAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemoPosition" ADD CONSTRAINT "DemoPosition_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_demoAccountId_fkey" FOREIGN KEY ("demoAccountId") REFERENCES "DemoAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountActivityLog" ADD CONSTRAINT "AccountActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountActivityLog" ADD CONSTRAINT "AccountActivityLog_demoAccountId_fkey" FOREIGN KEY ("demoAccountId") REFERENCES "DemoAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountActivityLog" ADD CONSTRAINT "AccountActivityLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "DemoOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountActivityLog" ADD CONSTRAINT "AccountActivityLog_fillId_fkey" FOREIGN KEY ("fillId") REFERENCES "DemoFill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
