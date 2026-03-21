import path from "node:path";

process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));

const DEMO_SYMBOLS = [
  ["ES", "E-mini S&P 500", "FUTURES", "0.25", "12.50", "5234.25"],
  ["NQ", "E-mini Nasdaq 100", "FUTURES", "0.25", "5.00", "18342.75"],
  ["CL", "Crude Oil", "FUTURES", "0.01", "10.00", "77.42"],
  ["GC", "Gold", "FUTURES", "0.10", "10.00", "2188.40"],
  ["BTC", "Bitcoin", "CRYPTO", "1.00", "1.00", "68420.00"]
] as const;

async function main() {
  const [{ getDb }, { hash }] = await Promise.all([import("../src/index"), import("bcryptjs")]);
  const db = getDb();
  const passwordHash = await hash("FundedPro123!", 10);

  await db.query(
    `
      INSERT INTO "User" ("id", "email", "fullName", "passwordHash", "role", "createdAt", "updatedAt")
      VALUES
        ('trader_seed_user', 'trader@fundedpro.com', 'Demo Trader', $1, 'TRADER', NOW(), NOW()),
        ('pro_seed_user', 'protrader@fundedpro.com', 'Pro Phase Trader', $1, 'TRADER', NOW(), NOW()),
        ('review_seed_user', 'reviewtrader@fundedpro.com', 'Review Queue Trader', $1, 'TRADER', NOW(), NOW()),
        ('funded_seed_user', 'fundedtrader@fundedpro.com', 'Funded Trader', $1, 'TRADER', NOW(), NOW()),
        ('breached_seed_user', 'breachedtrader@fundedpro.com', 'Breached Trader', $1, 'TRADER', NOW(), NOW()),
        ('passed_seed_user', 'passedtrader@fundedpro.com', 'Passed Trader', $1, 'TRADER', NOW(), NOW()),
        ('admin_seed_user', 'admin@fundedpro.com', 'FundedPro Admin', $1, 'ADMIN', NOW(), NOW())
      ON CONFLICT ("email")
      DO UPDATE SET "fullName" = EXCLUDED."fullName", "passwordHash" = EXCLUDED."passwordHash", "updatedAt" = NOW();
    `,
    [passwordHash]
  );

  await db.query(`
    INSERT INTO "Instrument" ("id", "symbol", "name", "assetClass", "tickSize", "tickValue", "defaultPrice", "createdAt", "updatedAt")
    VALUES
      ('instrument_es', 'ES', 'E-mini S&P 500', 'FUTURES', 0.25, 12.50, 5234.25, NOW(), NOW()),
      ('instrument_nq', 'NQ', 'E-mini Nasdaq 100', 'FUTURES', 0.25, 5.00, 18342.75, NOW(), NOW()),
      ('instrument_cl', 'CL', 'Crude Oil', 'FUTURES', 0.01, 10.00, 77.42, NOW(), NOW()),
      ('instrument_gc', 'GC', 'Gold', 'FUTURES', 0.10, 10.00, 2188.40, NOW(), NOW()),
      ('instrument_btc', 'BTC', 'Bitcoin', 'CRYPTO', 1.00, 1.00, 68420.00, NOW(), NOW())
    ON CONFLICT ("symbol")
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "assetClass" = EXCLUDED."assetClass",
      "tickSize" = EXCLUDED."tickSize",
      "tickValue" = EXCLUDED."tickValue",
      "defaultPrice" = EXCLUDED."defaultPrice",
      "updatedAt" = NOW();
  `);

  await db.query(`
    INSERT INTO "ChallengePlan" (
      "id", "slug", "name", "challengeType", "accountSize", "priceCents", "phaseCount",
      "profitTargetPct", "dailyDrawdownPct", "maxDrawdownPct", "minTradingDays", "payoutSplitPct",
      "resetEnabled", "createdAt", "updatedAt"
    )
    VALUES
      ('plan_starter', 'starter-50k', 'Starter', 'ONE_STEP', 50000, 8900, 1, 6.00, 3.00, 5.00, 3, 85.00, true, NOW(), NOW()),
      ('plan_pro', 'pro-100k', 'Pro', 'TWO_STEP', 100000, 14900, 2, 8.00, 3.00, 6.00, 3, 90.00, true, NOW(), NOW()),
      ('plan_elite', 'elite-150k', 'Elite', 'INSTANT', 150000, 22900, 1, 6.00, 2.50, 4.50, 5, 90.00, false, NOW(), NOW())
    ON CONFLICT ("slug")
    DO UPDATE SET "priceCents" = EXCLUDED."priceCents", "updatedAt" = NOW();
  `);

  await db.query(`
    INSERT INTO "ChallengeOrder" (
      "id", "userId", "challengePlanId", "stripeSessionId", "status", "createdAt", "updatedAt"
    )
    VALUES (
      'order_trader_starter', 'trader_seed_user', 'plan_starter', 'seed-session-trader-starter', 'PAID', NOW(), NOW()
    ), (
      'order_trader_pro', 'pro_seed_user', 'plan_pro', 'seed-session-trader-pro', 'PAID', NOW(), NOW()
    ), (
      'order_trader_review', 'review_seed_user', 'plan_pro', 'seed-session-trader-review', 'PAID', NOW(), NOW()
    ), (
      'order_trader_funded', 'funded_seed_user', 'plan_starter', 'seed-session-trader-funded', 'PAID', NOW(), NOW()
    ), (
      'order_trader_breached', 'breached_seed_user', 'plan_starter', 'seed-session-trader-breached', 'PAID', NOW(), NOW()
    ), (
      'order_trader_passed', 'passed_seed_user', 'plan_pro', 'seed-session-trader-passed', 'PAID', NOW(), NOW()
    )
    ON CONFLICT ("stripeSessionId")
    DO UPDATE SET "status" = EXCLUDED."status", "updatedAt" = NOW();
  `);

  await db.query(`
    INSERT INTO "TradingAccount" (
      "id", "userId", "login", "provider", "accountState", "currentPhase", "startingBalance", "phaseStartBalance", "currentBalance", "currentEquity",
      "dailyLossLimit", "totalLossLimit", "profitTarget", "tradingDays", "phaseStartedAt", "lastEvaluatedAt", "createdAt", "updatedAt"
    )
    VALUES (
      'account_trader_eval', 'trader_seed_user', 'FP100245', 'mock-mt5', 'EVALUATION', 1, 50000.00, 50000.00, 52780.42, 52410.36,
      1500.00, 2500.00, 3000.00, 4, NOW() - INTERVAL '4 days', NOW(), NOW(), NOW()
    ), (
      'account_trader_pro', 'pro_seed_user', 'FP200410', 'mock-mt5', 'EVALUATION', 2, 100000.00, 104250.00, 106180.00, 105860.00,
      3000.00, 6000.00, 8000.00, 5, NOW() - INTERVAL '5 days', NOW(), NOW(), NOW()
    ), (
      'account_trader_review', 'review_seed_user', 'FP200511', 'mock-mt5', 'REVIEW', 2, 100000.00, 104000.00, 108350.00, 108120.00,
      3000.00, 6000.00, 8000.00, 6, NOW() - INTERVAL '8 days', NOW(), NOW() - INTERVAL '1 day', NOW()
    ), (
      'account_trader_funded', 'funded_seed_user', 'FP300612', 'mock-mt5', 'FUNDED', 1, 50000.00, 50000.00, 53840.00, 53690.00,
      1500.00, 2500.00, 3000.00, 7, NOW() - INTERVAL '12 days', NOW(), NOW(), NOW()
    ), (
      'account_trader_breached', 'breached_seed_user', 'FP400713', 'mock-mt5', 'BREACHED', 1, 50000.00, 50000.00, 48620.00, 47420.00,
      1500.00, 2500.00, 3000.00, 2, NOW() - INTERVAL '2 days', NOW(), NOW(), NOW()
    ), (
      'account_trader_passed', 'passed_seed_user', 'FP500814', 'mock-mt5', 'PASSED', 2, 100000.00, 104000.00, 108420.00, 108180.00,
      3000.00, 6000.00, 8000.00, 7, NOW() - INTERVAL '10 days', NOW(), NOW(), NOW()
    )
    ON CONFLICT ("login")
    DO UPDATE SET
      "currentPhase" = EXCLUDED."currentPhase",
      "phaseStartBalance" = EXCLUDED."phaseStartBalance",
      "currentBalance" = EXCLUDED."currentBalance",
      "currentEquity" = EXCLUDED."currentEquity",
      "tradingDays" = EXCLUDED."tradingDays",
      "phaseStartedAt" = EXCLUDED."phaseStartedAt",
      "lastEvaluatedAt" = EXCLUDED."lastEvaluatedAt",
      "updatedAt" = NOW();
  `);

  await db.query(`
    INSERT INTO "Invoice" ("id", "userId", "challengeOrderId", "reference", "amountCents", "status", "createdAt", "updatedAt")
    VALUES
      ('invoice_seed_1', 'trader_seed_user', 'order_trader_starter', 'INV-FP-1001', 8900, 'PAID', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
      ('invoice_seed_2', 'pro_seed_user', 'order_trader_pro', 'INV-FP-1002', 14900, 'PAID', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
    ON CONFLICT ("reference")
    DO UPDATE SET "status" = EXCLUDED."status", "challengeOrderId" = EXCLUDED."challengeOrderId", "updatedAt" = NOW();
  `);

  await db.query(`
    INSERT INTO "ChallengeOrder" (
      "id", "userId", "challengePlanId", "stripeSessionId", "status", "createdAt", "updatedAt"
    )
    SELECT
      'order_townshend_funded',
      u."id",
      'plan_starter',
      'seed-session-townshend-funded',
      'PAID',
      NOW(),
      NOW()
    FROM "User" u
    WHERE u."email" = '25townshendh@gmail.com'
    ON CONFLICT ("stripeSessionId")
    DO UPDATE SET "status" = EXCLUDED."status", "updatedAt" = NOW();
  `);

  await db.query(`
    INSERT INTO "TradingAccount" (
      "id", "userId", "login", "provider", "accountState", "currentPhase", "startingBalance", "phaseStartBalance", "currentBalance", "currentEquity",
      "dailyLossLimit", "totalLossLimit", "profitTarget", "tradingDays", "phaseStartedAt", "lastEvaluatedAt", "createdAt", "updatedAt"
    )
    SELECT
      'account_townshend_funded',
      u."id",
      'FP860251',
      'mock-mt5',
      'FUNDED',
      1,
      50000.00,
      50000.00,
      54780.00,
      54610.00,
      1500.00,
      2500.00,
      3000.00,
      9,
      NOW() - INTERVAL '16 days',
      NOW(),
      NOW(),
      NOW()
    FROM "User" u
    WHERE u."email" = '25townshendh@gmail.com'
    ON CONFLICT ("login")
    DO UPDATE SET
      "userId" = EXCLUDED."userId",
      "accountState" = EXCLUDED."accountState",
      "currentPhase" = EXCLUDED."currentPhase",
      "phaseStartBalance" = EXCLUDED."phaseStartBalance",
      "currentBalance" = EXCLUDED."currentBalance",
      "currentEquity" = EXCLUDED."currentEquity",
      "tradingDays" = EXCLUDED."tradingDays",
      "phaseStartedAt" = EXCLUDED."phaseStartedAt",
      "lastEvaluatedAt" = EXCLUDED."lastEvaluatedAt",
      "updatedAt" = NOW();
  `);

  await db.query(`
    DELETE FROM "PayoutRequest"
    WHERE "userId" IN ('trader_seed_user', 'pro_seed_user', 'review_seed_user', 'funded_seed_user', 'townshend_seed_user', 'breached_seed_user', 'passed_seed_user');
  `);

  await db.query(`
    INSERT INTO "DemoAccount" (
      "id", "userId", "accountName", "startingBalance", "currentBalance", "buyingPower", "equity", "realizedPnl", "unrealizedPnl", "totalTrades", "status", "createdAt", "updatedAt"
    )
    VALUES
      ('demo_account_trader_seed', 'trader_seed_user', 'Starter Demo', 50000.00, 50000.00, 50000.00, 50000.00, 0, 0, 0, 'ACTIVE', NOW(), NOW()),
      ('demo_account_admin_seed', 'admin_seed_user', 'Admin Demo', 100000.00, 100000.00, 100000.00, 100000.00, 0, 0, 0, 'ACTIVE', NOW(), NOW())
    ON CONFLICT ("id")
    DO UPDATE SET
      "accountName" = EXCLUDED."accountName",
      "startingBalance" = EXCLUDED."startingBalance",
      "currentBalance" = EXCLUDED."currentBalance",
      "buyingPower" = EXCLUDED."buyingPower",
      "equity" = EXCLUDED."equity",
      "updatedAt" = NOW();
  `);

  await db.query(`
    UPDATE "User"
    SET "activeDemoAccountId" = CASE
      WHEN "id" = 'trader_seed_user' THEN 'demo_account_trader_seed'
      WHEN "id" = 'admin_seed_user' THEN 'demo_account_admin_seed'
      ELSE "activeDemoAccountId"
    END,
    "updatedAt" = NOW()
    WHERE "id" IN ('trader_seed_user', 'admin_seed_user');
  `);

  await db.query(`
    INSERT INTO "Watchlist" ("id", "userId", "demoAccountId", "name", "isDefault", "createdAt", "updatedAt")
    VALUES
      ('watchlist_trader_seed', 'trader_seed_user', 'demo_account_trader_seed', 'Core Futures', TRUE, NOW(), NOW()),
      ('watchlist_admin_seed', 'admin_seed_user', 'demo_account_admin_seed', 'Core Futures', TRUE, NOW(), NOW())
    ON CONFLICT ("id")
    DO UPDATE SET "name" = EXCLUDED."name", "updatedAt" = NOW();
  `);

  for (const [symbol, , , , , defaultPrice] of DEMO_SYMBOLS) {
    await db.query(
      `
        INSERT INTO "PriceTick" ("id", "instrumentId", "price", "changeAmount", "changePct", "source", "createdAt")
        SELECT $1, i."id", $2, 0, 0, 'seed', NOW()
        FROM "Instrument" i
        WHERE i."symbol" = $3
          AND NOT EXISTS (
            SELECT 1 FROM "PriceTick" pt WHERE pt."instrumentId" = i."id"
          )
      `,
      [`price_tick_${symbol.toLowerCase()}`, defaultPrice, symbol]
    );
  }

  await db.query(`
    INSERT INTO "WatchlistItem" ("id", "watchlistId", "instrumentId", "sortOrder", "createdAt")
    SELECT
      CONCAT('watchlist_item_trader_', LOWER(i."symbol")),
      'watchlist_trader_seed',
      i."id",
      v."sortOrder",
      NOW()
    FROM "Instrument" i
    JOIN (VALUES ('ES', 0), ('NQ', 1), ('CL', 2), ('GC', 3), ('BTC', 4)) AS v("symbol", "sortOrder")
      ON v."symbol" = i."symbol"
    ON CONFLICT ("watchlistId", "instrumentId") DO NOTHING;
  `);

  await db.query(`
    INSERT INTO "WatchlistItem" ("id", "watchlistId", "instrumentId", "sortOrder", "createdAt")
    SELECT
      CONCAT('watchlist_item_admin_', LOWER(i."symbol")),
      'watchlist_admin_seed',
      i."id",
      v."sortOrder",
      NOW()
    FROM "Instrument" i
    JOIN (VALUES ('ES', 0), ('NQ', 1), ('CL', 2), ('GC', 3), ('BTC', 4)) AS v("symbol", "sortOrder")
      ON v."symbol" = i."symbol"
    ON CONFLICT ("watchlistId", "instrumentId") DO NOTHING;
  `);

  await db.query(`
    INSERT INTO "AccountActivityLog" ("id", "userId", "demoAccountId", "type", "summary", "metadata", "createdAt")
    VALUES
      ('demo_log_trader_seed', 'trader_seed_user', 'demo_account_trader_seed', 'ACCOUNT_CREATED', 'Starter demo account seeded.', '{"source":"seed"}', NOW()),
      ('demo_log_admin_seed', 'admin_seed_user', 'demo_account_admin_seed', 'ACCOUNT_CREATED', 'Starter demo account seeded.', '{"source":"seed"}', NOW())
    ON CONFLICT ("id")
    DO UPDATE SET "summary" = EXCLUDED."summary", "createdAt" = EXCLUDED."createdAt";
  `);

  await db.query(`
    INSERT INTO "PayoutRequest" (
      "id", "userId", "tradingAccountId", "amountCents", "status", "note", "createdAt", "updatedAt"
    )
    VALUES (
      'payout_seed_funded_pending',
      'funded_seed_user',
      'account_trader_funded',
      125000,
      'PENDING',
      'Seeded funded payout request for admin review.',
      NOW() - INTERVAL '6 hours',
      NOW() - INTERVAL '6 hours'
    )
    ON CONFLICT ("id")
    DO UPDATE SET
      "amountCents" = EXCLUDED."amountCents",
      "status" = EXCLUDED."status",
      "note" = EXCLUDED."note",
      "updatedAt" = NOW();
  `);

  await db.end();
  console.log("Seed complete.");
  console.log("Demo trader: trader@fundedpro.com / FundedPro123!");
  console.log("Pro trader: protrader@fundedpro.com / FundedPro123!");
  console.log("Review trader: reviewtrader@fundedpro.com / FundedPro123!");
  console.log("Funded trader: fundedtrader@fundedpro.com / FundedPro123!");
  console.log("Breached trader: breachedtrader@fundedpro.com / FundedPro123!");
  console.log("Passed trader: passedtrader@fundedpro.com / FundedPro123!");
  console.log("Demo admin: admin@fundedpro.com / FundedPro123!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
