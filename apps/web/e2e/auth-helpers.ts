import path from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { type Page } from "@playwright/test";
import { Client } from "pg";

process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const sessionSecret = process.env.NEXTAUTH_SECRET;
const databaseUrl = process.env.DATABASE_URL;

if (!sessionSecret) {
  throw new Error("NEXTAUTH_SECRET is required for authenticated Playwright coverage.");
}

const resolvedSessionSecret: string = sessionSecret;

type UserRole = "TRADER" | "ADMIN";

export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: UserRole;
  terminalAccountId?: string;
};

export const traderSeed = {
  userId: "trader_seed_user",
  email: "trader@fundedpro.com",
  role: "TRADER" as const,
  tradingAccountId: "account_trader_eval"
};

export const breachedTraderSeed = {
  userId: "breached_seed_user",
  email: "breachedtrader@fundedpro.com",
  role: "TRADER" as const,
  tradingAccountId: "account_trader_breached"
};

export const adminSeed = {
  userId: "admin_seed_user",
  email: "admin@fundedpro.com",
  role: "ADMIN" as const
};

export async function authenticateAsUser(page: Page, input: AuthenticatedUser) {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const encodedBody = Buffer.from(JSON.stringify({
    userId: input.userId,
    email: input.email,
    role: input.role,
    iat: now,
    exp: now + 60 * 60 * 24 * 7
  })).toString("base64url");
  const unsignedToken = `${encodedHeader}.${encodedBody}`;
  const signature = createHmac("sha256", resolvedSessionSecret).update(unsignedToken).digest("base64url");

  await page.context().addCookies([
    {
      name: "fundedpro_session",
      value: `${unsignedToken}.${signature}`,
      url: baseURL
    },
    ...(input.terminalAccountId ? [{
      name: "demo_terminal_access",
      value: input.terminalAccountId,
      url: baseURL
    }] : [])
  ]);
}

async function withClient<T>(callback: (client: Client) => Promise<T>) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Playwright database fixtures.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

export async function cleanupE2eUser(userId: string) {
  await withClient(async (client) => {
    await client.query("BEGIN");

    try {
      await client.query(
        'DELETE FROM "AccountActivityLog" WHERE "userId" = $1 OR "demoAccountId" IN (SELECT "id" FROM "DemoAccount" WHERE "userId" = $1)',
        [userId]
      );
      await client.query(
        'DELETE FROM "DemoFill" WHERE "userId" = $1 OR "demoAccountId" IN (SELECT "id" FROM "DemoAccount" WHERE "userId" = $1)',
        [userId]
      );
      await client.query(
        'DELETE FROM "DemoOrder" WHERE "userId" = $1 OR "demoAccountId" IN (SELECT "id" FROM "DemoAccount" WHERE "userId" = $1)',
        [userId]
      );
      await client.query(
        'DELETE FROM "DemoPosition" WHERE "userId" = $1 OR "demoAccountId" IN (SELECT "id" FROM "DemoAccount" WHERE "userId" = $1)',
        [userId]
      );
      await client.query(
        'DELETE FROM "WatchlistItem" WHERE "watchlistId" IN (SELECT "id" FROM "Watchlist" WHERE "userId" = $1 OR "demoAccountId" IN (SELECT "id" FROM "DemoAccount" WHERE "userId" = $1))',
        [userId]
      );
      await client.query(
        'DELETE FROM "Watchlist" WHERE "userId" = $1 OR "demoAccountId" IN (SELECT "id" FROM "DemoAccount" WHERE "userId" = $1)',
        [userId]
      );
      await client.query(
        'DELETE FROM "PayoutRequest" WHERE "userId" = $1 OR "tradingAccountId" IN (SELECT "id" FROM "TradingAccount" WHERE "userId" = $1)',
        [userId]
      );
      await client.query('DELETE FROM "DemoAccount" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "TradingAccount" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "Invoice" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "ChallengeOrder" WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM "AuditLog" WHERE "actorUserId" = $1', [userId]);
      await client.query('DELETE FROM "User" WHERE "id" = $1', [userId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function createCheckoutFixtureUser() {
  const userId = `e2e_checkout_${randomUUID()}`;
  const orderId = `e2e_order_${randomUUID()}`;
  const invoiceId = `e2e_invoice_${randomUUID()}`;
  const email = `checkout+${userId}@fundedpro.test`;
  const passwordHash = await hash("FundedPro123!", 10);

  await withClient(async (client) => {
    await client.query("BEGIN");

    try {
      await client.query(
        `
          INSERT INTO "User" ("id", "email", "fullName", "passwordHash", "emailVerifiedAt", "role", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, NOW(), 'TRADER', NOW(), NOW())
        `,
        [userId, email, "Checkout E2E Trader", passwordHash]
      );
      await client.query(
        `
          INSERT INTO "ChallengeOrder" ("id", "userId", "challengePlanId", "stripeSessionId", "status", "createdAt", "updatedAt")
          SELECT $1, $2, "id", 'mock-session-e2e-checkout', 'OPEN', NOW(), NOW()
          FROM "ChallengePlan"
          WHERE "slug" = 'pro-100k'
          LIMIT 1
        `,
        [orderId, userId]
      );
      await client.query(
        `
          INSERT INTO "Invoice" ("id", "userId", "challengeOrderId", "reference", "amountCents", "status", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, 'OPEN', NOW(), NOW())
        `,
        [invoiceId, userId, orderId, `INV-E2E-${orderId.slice(-8).toUpperCase()}`, 21000]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  return {
    userId,
    email,
    role: "TRADER" as const,
    orderId
  };
}
