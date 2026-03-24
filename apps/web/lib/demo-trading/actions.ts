"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@fundedpro/db";
import { getSession } from "../auth";
import { DEMO_TERMINAL_ACCESS_COOKIE, DEMO_TERMINAL_REMEMBER_COOKIE } from "./constants";
import { placeDemoOrder, recalculateDemoAccountState } from "./engine";
import { demoPositionProtectionColumnsAvailable } from "./protection-columns";
import { decryptTradingPassword, encryptTradingPassword } from "../trading-credentials";

const createAccountSchema = z.object({
  accountName: z.string().trim().min(1).max(80)
});

const accountIdSchema = z.object({
  demoAccountId: z.string().min(1),
  accountId: z.string().min(1).optional()
});

const renameAccountSchema = z.object({
  demoAccountId: z.string().min(1),
  accountName: z.string().trim().min(1).max(80),
  accountId: z.string().min(1).optional()
});

const orderSchema = z.object({
  demoAccountId: z.string().min(1),
  instrumentId: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT"]),
  quantity: z.coerce.number().int().min(1).max(1000),
  limitPrice: z.preprocess((value) => (value === "" || value == null ? undefined : value), z.coerce.number().positive().optional()),
  symbol: z.string().optional(),
  tab: z.string().optional(),
  accountId: z.string().optional(),
  timeframe: z.string().optional(),
  layout: z.string().optional()
});

const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
  symbol: z.string().optional(),
  tab: z.string().optional(),
  accountId: z.string().optional(),
  timeframe: z.string().optional(),
  layout: z.string().optional()
});

const protectionSchema = z.object({
  demoAccountId: z.string().min(1),
  instrumentId: z.string().min(1),
  takeProfitPrice: z.preprocess((value) => (value === "" || value == null ? undefined : value), z.coerce.number().positive().optional()),
  stopLossPrice: z.preprocess((value) => (value === "" || value == null ? undefined : value), z.coerce.number().positive().optional())
});

const terminalLoginSchema = z.object({
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(200),
  rememberMe: z.boolean().optional(),
  accountId: z.string().min(1).optional(),
  symbol: z.string().optional(),
  tab: z.string().optional(),
  timeframe: z.string().optional(),
  layout: z.string().optional()
});

async function requireTrader() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

function buildRedirect(params: Record<string, string | undefined>): never {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  redirect(`/dashboard/trades${query ? `?${query}` : ""}`);
}

async function submitDemoOrder(formData: FormData, sessionUserId: string) {
  const parsed = orderSchema.safeParse({
    demoAccountId: formData.get("demoAccountId"),
    instrumentId: formData.get("instrumentId"),
    side: formData.get("side"),
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    limitPrice: formData.get("limitPrice"),
    symbol: formData.get("symbol") || undefined,
    tab: formData.get("tab") || undefined,
    accountId: formData.get("accountId") || undefined,
    timeframe: formData.get("timeframe") || undefined,
    layout: formData.get("layout") || undefined
  });

  if (!parsed.success || (parsed.data.type === "LIMIT" && parsed.data.limitPrice == null)) {
    return {
      ok: false as const,
      code: "invalid-order" as const,
      params: {
        symbol: String(formData.get("symbol") ?? ""),
        tab: String(formData.get("tab") ?? "orders"),
        accountId: String(formData.get("accountId") ?? ""),
        timeframe: String(formData.get("timeframe") ?? ""),
        layout: String(formData.get("layout") ?? "")
      }
    };
  }

  const data = parsed.data;

  try {
    await placeDemoOrder({
      userId: sessionUserId,
      demoAccountId: data.demoAccountId,
      instrumentId: data.instrumentId,
      side: data.side,
      type: data.type,
      quantity: data.quantity,
      limitPrice: data.limitPrice ?? null
    });

    return {
      ok: true as const,
      params: {
        symbol: data.symbol,
        tab: data.tab ?? "orders",
        accountId: data.accountId,
        timeframe: data.timeframe,
        layout: data.layout
      }
    };
  } catch (error) {
    return {
      ok: false as const,
      code:
        error instanceof Error && error.message === "MARKET_CLOSED"
          ? "market-closed" as const
          : error instanceof Error && error.message === "ACCOUNT_BREACHED"
            ? "account-breached" as const
            : error instanceof Error && error.message === "PRICE_STALE"
              ? "price-stale" as const
            : "order-rejected" as const,
      params: {
        symbol: data.symbol,
        tab: data.tab ?? "orders",
        accountId: data.accountId,
        timeframe: data.timeframe,
        layout: data.layout
      }
    };
  }
}

export async function createDemoAccountAction(formData: FormData) {
  const session = await requireTrader();
  const parsed = createAccountSchema.safeParse({
    accountName: formData.get("accountName")
  });

  if (!parsed.success) {
    buildRedirect({ error: "invalid-account-name" });
  }
  const data = parsed.data;

  const db = getDb();
  const accountId = randomUUID();

  await db.query(
    `
      INSERT INTO "DemoAccount" (
        "id", "userId", "accountName", "startingBalance", "currentBalance", "buyingPower", "equity", "realizedPnl", "unrealizedPnl", "totalTrades", "status", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, 50000, 50000, 50000, 50000, 0, 0, 0, 'ACTIVE', NOW(), NOW())
    `,
    [accountId, session.userId, data.accountName]
  );

  await db.query(
    'UPDATE "User" SET "activeDemoAccountId" = $1, "updatedAt" = NOW() WHERE "id" = $2',
    [accountId, session.userId]
  );

  await db.query(
    `
      INSERT INTO "AccountActivityLog" ("id", "userId", "demoAccountId", "type", "summary", "metadata", "createdAt")
      VALUES ($1, $2, $3, 'ACCOUNT_CREATED', $4, $5::jsonb, NOW())
    `,
    [randomUUID(), session.userId, accountId, `Demo account ${data.accountName} created.`, JSON.stringify({ accountName: data.accountName })]
  );

  buildRedirect({ success: "account-created" });
}

export async function switchActiveDemoAccountAction(formData: FormData) {
  const session = await requireTrader();
  const parsed = accountIdSchema.safeParse({
    demoAccountId: formData.get("demoAccountId"),
    accountId: formData.get("accountId") || undefined
  });

  if (!parsed.success) {
    buildRedirect({ error: "invalid-account" });
  }
  const data = parsed.data;

  const db = getDb();
  const ownedAccount = await db.query<{ id: string }>(
    'SELECT "id" FROM "DemoAccount" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
    [data.demoAccountId, session.userId]
  );

  if (!ownedAccount.rows[0]) {
    buildRedirect({ error: "invalid-account" });
  }

  await db.query(
    'UPDATE "User" SET "activeDemoAccountId" = $1, "updatedAt" = NOW() WHERE "id" = $2',
    [data.demoAccountId, session.userId]
  );

  buildRedirect({ success: "account-switched", accountId: data.accountId });
}

export async function renameDemoAccountAction(formData: FormData) {
  const session = await requireTrader();
  const parsed = renameAccountSchema.safeParse({
    demoAccountId: formData.get("demoAccountId"),
    accountName: formData.get("accountName"),
    accountId: formData.get("accountId") || undefined
  });

  if (!parsed.success) {
    buildRedirect({ error: "invalid-account-name" });
  }
  const data = parsed.data;

  await getDb().query(
    `
      UPDATE "DemoAccount"
      SET "accountName" = $1, "updatedAt" = NOW()
      WHERE "id" = $2 AND "userId" = $3
    `,
    [data.accountName, data.demoAccountId, session.userId]
  );

  buildRedirect({ success: "account-renamed", accountId: data.accountId });
}

export async function resetDemoAccountAction(formData: FormData) {
  const session = await requireTrader();
  const parsed = accountIdSchema.safeParse({
    demoAccountId: formData.get("demoAccountId"),
    accountId: formData.get("accountId") || undefined
  });

  if (!parsed.success) {
    buildRedirect({ error: "invalid-account", accountId: String(formData.get("accountId") ?? "") });
  }
  const data = parsed.data;

  const db = getDb();
  const accountResult = await db.query<{ id: string; startingBalance: string }>(
    'SELECT "id", "startingBalance"::text FROM "DemoAccount" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
    [data.demoAccountId, session.userId]
  );
  const account = accountResult.rows[0];

  if (!account) {
    buildRedirect({ error: "invalid-account" });
  }
  const ensuredAccount = account as { id: string; startingBalance: string };

  await db.query('DELETE FROM "AccountActivityLog" WHERE "demoAccountId" = $1', [ensuredAccount.id]);
  await db.query('DELETE FROM "DemoFill" WHERE "demoAccountId" = $1', [ensuredAccount.id]);
  await db.query('DELETE FROM "DemoOrder" WHERE "demoAccountId" = $1', [ensuredAccount.id]);
  await db.query('DELETE FROM "DemoPosition" WHERE "demoAccountId" = $1', [ensuredAccount.id]);
  await db.query(
    `
      UPDATE "DemoAccount"
      SET
        "currentBalance" = $1,
        "buyingPower" = $1,
        "equity" = $1,
        "realizedPnl" = 0,
        "unrealizedPnl" = 0,
        "totalTrades" = 0,
        "updatedAt" = NOW()
      WHERE "id" = $2
    `,
    [Number(ensuredAccount.startingBalance), ensuredAccount.id]
  );

  await db.query(
    `
      INSERT INTO "AccountActivityLog" ("id", "userId", "demoAccountId", "type", "summary", "metadata", "createdAt")
      VALUES ($1, $2, $3, 'ACCOUNT_RESET', 'Demo account reset to starting balance.', '{"source":"manual"}', NOW())
    `,
    [randomUUID(), session.userId, ensuredAccount.id]
  );

  buildRedirect({ success: "account-reset", accountId: data.accountId });
}

export async function deleteDemoAccountAction(formData: FormData) {
  const session = await requireTrader();
  const parsed = accountIdSchema.safeParse({
    demoAccountId: formData.get("demoAccountId"),
    accountId: formData.get("accountId") || undefined
  });

  if (!parsed.success) {
    buildRedirect({ error: "invalid-account", accountId: String(formData.get("accountId") ?? "") });
  }
  const data = parsed.data;

  const db = getDb();
  const fallbackAccount = await db.query<{ id: string }>(
    `
      SELECT "id"
      FROM "DemoAccount"
      WHERE "userId" = $1 AND "id" <> $2
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    [session.userId, data.demoAccountId]
  );

  await db.query('DELETE FROM "WatchlistItem" WHERE "watchlistId" IN (SELECT "id" FROM "Watchlist" WHERE "demoAccountId" = $1)', [data.demoAccountId]);
  await db.query('DELETE FROM "Watchlist" WHERE "demoAccountId" = $1', [data.demoAccountId]);
  await db.query('DELETE FROM "AccountActivityLog" WHERE "demoAccountId" = $1', [data.demoAccountId]);
  await db.query('DELETE FROM "DemoFill" WHERE "demoAccountId" = $1', [data.demoAccountId]);
  await db.query('DELETE FROM "DemoOrder" WHERE "demoAccountId" = $1', [data.demoAccountId]);
  await db.query('DELETE FROM "DemoPosition" WHERE "demoAccountId" = $1', [data.demoAccountId]);
  await db.query('DELETE FROM "DemoAccount" WHERE "id" = $1 AND "userId" = $2', [data.demoAccountId, session.userId]);
  await db.query(
    'UPDATE "User" SET "activeDemoAccountId" = $1, "updatedAt" = NOW() WHERE "id" = $2',
    [fallbackAccount.rows[0]?.id ?? null, session.userId]
  );

  buildRedirect({ success: "account-deleted", accountId: data.accountId });
}

export async function placeDemoOrderAction(formData: FormData) {
  const session = await requireTrader();
  const result = await submitDemoOrder(formData, session.userId);

  if (!result.ok) {
    buildRedirect({ error: result.code, ...result.params });
  }

  buildRedirect({ success: "order-submitted", ...result.params });
}

export async function submitDemoOrderAction(formData: FormData) {
  const session = await requireTrader();
  const result = await submitDemoOrder(formData, session.userId);

  return result.ok
    ? { ok: true as const }
    : { ok: false as const, error: result.code };
}

export async function cancelDemoOrderAction(formData: FormData) {
  const session = await requireTrader();
  const parsed = cancelOrderSchema.safeParse({
    orderId: formData.get("orderId"),
    symbol: formData.get("symbol") || undefined,
    tab: formData.get("tab") || undefined,
    accountId: formData.get("accountId") || undefined,
    timeframe: formData.get("timeframe") || undefined,
    layout: formData.get("layout") || undefined
  });

  if (!parsed.success) {
    buildRedirect({ error: "invalid-order", tab: "orders" });
  }
  const data = parsed.data;
  const db = getDb();
  const orderResult = await db.query<{ id: string; demoAccountId: string }>(
    `
      SELECT o."id", o."demoAccountId"
      FROM "DemoOrder" o
      JOIN "DemoAccount" da ON da."id" = o."demoAccountId"
      WHERE o."id" = $1 AND da."userId" = $2 AND o."status" = 'WORKING'
      LIMIT 1
    `,
    [data.orderId, session.userId]
  );
  const order = orderResult.rows[0];

  if (!order) {
    buildRedirect({ error: "invalid-order", symbol: data.symbol, tab: data.tab ?? "orders", accountId: data.accountId, timeframe: data.timeframe, layout: data.layout });
  }

  await db.query(
    `UPDATE "DemoOrder" SET "status" = 'CANCELED', "remainingQuantity" = 0, "updatedAt" = NOW() WHERE "id" = $1`,
    [order.id]
  );
  await db.query(
    `
      INSERT INTO "AccountActivityLog" ("id", "userId", "demoAccountId", "orderId", "type", "summary", "metadata", "createdAt")
      VALUES ($1, $2, $3, $4, 'ORDER_CANCELED', 'Working order canceled.', $5::jsonb, NOW())
    `,
    [randomUUID(), session.userId, order.demoAccountId, order.id, JSON.stringify({ orderId: order.id })]
  );
  await recalculateDemoAccountState(order.demoAccountId);

  buildRedirect({ success: "order-canceled", symbol: data.symbol, tab: data.tab ?? "orders", accountId: data.accountId, timeframe: data.timeframe, layout: data.layout });
}

export async function updateDemoPositionProtectionAction(formData: FormData) {
  const session = await requireTrader();
  const hasProtectionColumns = await demoPositionProtectionColumnsAvailable();

  if (!hasProtectionColumns) {
    return { ok: false as const, error: "protection-unavailable" as const };
  }

  const parsed = protectionSchema.safeParse({
    demoAccountId: formData.get("demoAccountId"),
    instrumentId: formData.get("instrumentId"),
    takeProfitPrice: formData.get("takeProfitPrice"),
    stopLossPrice: formData.get("stopLossPrice")
  });

  if (!parsed.success) {
    return { ok: false as const, error: "invalid-protection" as const };
  }

  const data = parsed.data;
  const db = getDb();
  const positionResult = await db.query<{ id: string }>(
    `
      SELECT p."id"
      FROM "DemoPosition" p
      JOIN "DemoAccount" da ON da."id" = p."demoAccountId"
      WHERE p."demoAccountId" = $1 AND p."instrumentId" = $2 AND da."userId" = $3
      LIMIT 1
    `,
    [data.demoAccountId, data.instrumentId, session.userId]
  );

  const position = positionResult.rows[0];

  if (!position) {
    return { ok: false as const, error: "invalid-protection" as const };
  }

  await db.query(
    `
      UPDATE "DemoPosition"
      SET
        "takeProfitPrice" = $1,
        "stopLossPrice" = $2,
        "updatedAt" = NOW()
      WHERE "id" = $3
    `,
    [data.takeProfitPrice ?? null, data.stopLossPrice ?? null, position.id]
  );

  await db.query(
    `
      INSERT INTO "AccountActivityLog" ("id", "userId", "demoAccountId", "type", "summary", "metadata", "createdAt")
      VALUES ($1, $2, $3, 'POSITION_PROTECTION_UPDATED', $4, $5::jsonb, NOW())
    `,
    [
      randomUUID(),
      session.userId,
      data.demoAccountId,
      "Position protection updated.",
      JSON.stringify({
        instrumentId: data.instrumentId,
        takeProfitPrice: data.takeProfitPrice ?? null,
        stopLossPrice: data.stopLossPrice ?? null
      })
    ]
  );

  await recalculateDemoAccountState(data.demoAccountId);

  return { ok: true as const };
}

export async function unlockDemoTerminalAction(formData: FormData) {
  const session = await requireTrader();
  const parsed = terminalLoginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
    accountId: formData.get("accountId") || undefined,
    symbol: formData.get("symbol") || undefined,
    tab: formData.get("tab") || undefined,
    timeframe: formData.get("timeframe") || undefined,
    layout: formData.get("layout") || undefined
  });

  if (!parsed.success) {
    buildRedirect({
      error: "terminal-login",
      accountId: String(formData.get("accountId") ?? ""),
      symbol: String(formData.get("symbol") ?? ""),
      tab: String(formData.get("tab") ?? ""),
      timeframe: String(formData.get("timeframe") ?? ""),
      layout: String(formData.get("layout") ?? "")
    });
  }

  const db = getDb();
  const accountCredentialsResult = await db.query<{
    email: string;
    tradingAccountId: string;
    login: string | null;
    tradingPassword: string | null;
  }>(
    `
      SELECT
        u."email",
        ta."id" AS "tradingAccountId",
        ta."login",
        ta."tradingPassword"
      FROM "User" u
      LEFT JOIN "TradingAccount" ta ON ta."userId" = u."id"
      WHERE u."id" = $1
      ORDER BY ta."createdAt" DESC NULLS LAST
    `,
    [session.userId]
  );
  const credentials = accountCredentialsResult.rows;
  const user = credentials[0];

  if (!user) {
    buildRedirect({ error: "terminal-login", accountId: parsed.data.accountId, symbol: parsed.data.symbol, tab: parsed.data.tab, timeframe: parsed.data.timeframe, layout: parsed.data.layout });
  }

  const username = parsed.data.username.toLowerCase();
  const selectedCredentials = parsed.data.accountId
    ? credentials.find((item) => item.tradingAccountId === parsed.data.accountId) ?? null
    : credentials.find((item) => item.login && item.tradingPassword && [user.email.toLowerCase(), item.login.toLowerCase()].includes(username)) ?? null;
  const allowedUsernames = selectedCredentials ? [user.email.toLowerCase(), selectedCredentials.login?.toLowerCase()].filter(Boolean) : [];
  const validPassword = selectedCredentials?.tradingPassword
    ? parsed.data.password === decryptTradingPassword(selectedCredentials.tradingPassword)
    : false;

  if (!selectedCredentials || !allowedUsernames.includes(username) || !validPassword) {
    buildRedirect({ error: "terminal-login", accountId: parsed.data.accountId, symbol: parsed.data.symbol, tab: parsed.data.tab, timeframe: parsed.data.timeframe, layout: parsed.data.layout });
  }

  const resolvedAccountId = selectedCredentials.tradingAccountId;

  const cookieStore = await cookies();
  cookieStore.set(DEMO_TERMINAL_ACCESS_COOKIE, resolvedAccountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/dashboard/trades"
  });
  if (parsed.data.rememberMe) {
    cookieStore.set(
      DEMO_TERMINAL_REMEMBER_COOKIE,
      Buffer.from(JSON.stringify({
        accountId: resolvedAccountId,
        login: parsed.data.username,
        password: encryptTradingPassword(parsed.data.password)
      })).toString("base64url"),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/dashboard/trades",
        maxAge: 60 * 60 * 24 * 30
      }
    );
  } else {
    cookieStore.delete(DEMO_TERMINAL_REMEMBER_COOKIE);
  }

  buildRedirect({ accountId: resolvedAccountId, symbol: parsed.data.symbol, tab: parsed.data.tab, timeframe: parsed.data.timeframe, layout: parsed.data.layout });
}
