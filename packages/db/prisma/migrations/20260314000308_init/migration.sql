-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRADER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('ONE_STEP', 'TWO_STEP', 'INSTANT');

-- CreateEnum
CREATE TYPE "AccountState" AS ENUM ('PENDING', 'EVALUATION', 'FUNDED', 'PASSED', 'FAILED', 'BREACHED', 'REVIEW', 'RESET');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TRADER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengePlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "challengeType" "ChallengeType" NOT NULL,
    "accountSize" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "phaseCount" INTEGER NOT NULL,
    "profitTargetPct" DECIMAL(5,2) NOT NULL,
    "dailyDrawdownPct" DECIMAL(5,2) NOT NULL,
    "maxDrawdownPct" DECIMAL(5,2) NOT NULL,
    "minTradingDays" INTEGER NOT NULL,
    "payoutSplitPct" DECIMAL(5,2) NOT NULL,
    "resetEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengePlanId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountState" "AccountState" NOT NULL DEFAULT 'PENDING',
    "startingBalance" DECIMAL(12,2) NOT NULL,
    "currentBalance" DECIMAL(12,2) NOT NULL,
    "currentEquity" DECIMAL(12,2) NOT NULL,
    "dailyLossLimit" DECIMAL(12,2) NOT NULL,
    "totalLossLimit" DECIMAL(12,2) NOT NULL,
    "profitTarget" DECIMAL(12,2) NOT NULL,
    "tradingDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengePlan_slug_key" ON "ChallengePlan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeOrder_stripeSessionId_key" ON "ChallengeOrder"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TradingAccount_login_key" ON "TradingAccount"("login");

-- AddForeignKey
ALTER TABLE "ChallengeOrder" ADD CONSTRAINT "ChallengeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeOrder" ADD CONSTRAINT "ChallengeOrder_challengePlanId_fkey" FOREIGN KEY ("challengePlanId") REFERENCES "ChallengePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
