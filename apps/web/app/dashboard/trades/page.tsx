import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { SiteShell } from "@fundedpro/ui";
import { getSession } from "../../../lib/auth";
import {
  cancelDemoOrderAction,
  createDemoAccountAction,
  unlockDemoTerminalAction,
} from "../../../lib/demo-trading/actions";
import { DEMO_TERMINAL_ACCESS_COOKIE, DEMO_TERMINAL_REMEMBER_COOKIE } from "../../../lib/demo-trading/constants";
import { getMaxContractsForBalance } from "../../../lib/demo-trading/contracts";
import type { ChartTimeframe } from "../../../lib/demo-trading/delayed-feed";
import { getDemoTradingTerminal } from "../../../lib/demo-trading/service";
import { getChartFeed } from "../../../lib/market-data";
import { ensureOwnerShowcaseWorkspace } from "../../../lib/owner-showcase";
import { decryptTradingPassword } from "../../../lib/trading-credentials";
import { FlashToast, type ToastItem } from "../../components/flash-toast";
import { LiveChart } from "./live-chart";
import { ConfirmButton } from "./confirm-button";
import { PositionsTable } from "./positions-table";
import { TradeAccountStatus } from "./trade-account-status";
import { TradeAutoRefresh } from "./trade-auto-refresh";
import { TradeLiveProvider } from "./trade-live-context";
import { TradeStripActions } from "./trade-strip-actions";
import { TradeTerminalControls } from "./trade-terminal-controls";

export const dynamic = "force-dynamic";

type TradeNowPageProps = {
  searchParams: Promise<{ accountId?: string; symbol?: string; tab?: string; timeframe?: string; layout?: string; success?: string; error?: string }>;
};

type Timeframe = ChartTimeframe;

const messages = {
  success: {
    "account-created": "Demo account created.",
    "account-switched": "Active demo account updated.",
    "account-renamed": "Demo account renamed.",
    "account-reset": "Demo account reset to starting balance.",
    "account-deleted": "Demo account deleted.",
    "order-submitted": "Paper order submitted.",
    "order-canceled": "Working order canceled."
  },
  error: {
    "invalid-account-name": "Enter a valid demo account name.",
    "invalid-account": "That demo account could not be found.",
    "invalid-order": "Enter a valid order before submitting.",
    "account-breached": "This account is breached. Trade entry is locked.",
    "market-closed": "Market is closed for this instrument right now.",
    "order-rejected": "Order was rejected. Check buying power and inputs.",
    "terminal-login": "Username or password is incorrect."
  }
} as const;

function formatUsd(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatPrice(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSigned(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString("en-US", { signDisplay: "always", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatWhole(value: number) {
  return Math.max(0, Math.floor(value)).toLocaleString("en-US");
}

function buildDepthRows(price: number, tickSize: number) {
  return Array.from({ length: 18 }, (_, index) => {
    const offset = 8 - index;
    const rowPrice = price + offset * tickSize;
    const size = Math.max(1, Math.round((Math.abs(offset) + 1) * 1.2));
    return {
      price: rowPrice,
      bid: offset < 0 ? size : 0,
      ask: offset > 0 ? size : 0,
      last: offset === 0
    };
  });
}

function isTimeframe(value: string | undefined): value is Timeframe {
  return value === "1m" || value === "5m" || value === "15m" || value === "1h" || value === "1d" || value === "1w";
}

export default async function TradeNowPage({ searchParams }: TradeNowPageProps) {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fdashboard%2Ftrades");

  await ensureOwnerShowcaseWorkspace(session.userId, session.email);

  const filters = await searchParams;
  const cookieStore = await cookies();
  const terminalAccessAccountId = cookieStore.get(DEMO_TERMINAL_ACCESS_COOKIE)?.value;
  const rememberedTerminal = (() => {
    const raw = cookieStore.get(DEMO_TERMINAL_REMEMBER_COOKIE)?.value;

    if (!raw) return null;

    try {
      const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
        accountId?: string;
        login?: string;
        password?: string;
      };

      return {
        login: parsed.login ?? "",
        password: decryptTradingPassword(parsed.password) ?? ""
      };
    } catch {
      return null;
    }
  })();
  const requestedAccountId = filters.accountId;
  let hasTerminalAccess = false;

  if (requestedAccountId && terminalAccessAccountId) {
    if (terminalAccessAccountId === requestedAccountId) {
      hasTerminalAccess = true;
    } else {
      const db = getDb();
      const accessibleAccounts = await db.query<{ id: string }>(
        `
          SELECT "id"
          FROM "TradingAccount"
          WHERE "userId" = $1
            AND "id" = ANY($2::text[])
        `,
        [session.userId, [terminalAccessAccountId, requestedAccountId]]
      );

      hasTerminalAccess = accessibleAccounts.rowCount === 2;
    }
  }

  const errorMessage = filters.error ? messages.error[filters.error as keyof typeof messages.error] ?? "Action failed." : null;

  const terminal = await getDemoTradingTerminal(session.userId, filters);
  const accountQuery = filters.accountId ? `accountId=${encodeURIComponent(filters.accountId)}&` : "";
  const symbol = terminal.selectedInstrument?.symbol ?? "ES";
  const timeframe: Timeframe = isTimeframe(filters.timeframe) ? filters.timeframe : "5m";
  const layout = filters.layout === "split" ? "split" : "focus";
  const initialChart = await getChartFeed({ symbol, timeframe });
  const quickSymbols = terminal.watchlistItems.filter((item) => item.symbol === "ES" || item.symbol === "NQ").slice(0, 2);
  const splitSymbols = quickSymbols.length === 2 ? quickSymbols.map((item) => item.symbol) : [symbol];
  const secondarySymbol = splitSymbols.find((item) => item !== symbol) ?? symbol;
  const secondaryChart = secondarySymbol === symbol ? initialChart : await getChartFeed({ symbol: secondarySymbol, timeframe });
  const initialCandles = initialChart.candles;
  const initialLastPrice = Number(initialChart.lastPrice || terminal.selectedInstrument?.price || 0);
  const successMessage = filters.success ? messages.success[filters.success as keyof typeof messages.success] ?? "Action completed." : null;
  const toastItems: ToastItem[] = [];
  if (successMessage) toastItems.push({ id: "trade-success", tone: "success", message: successMessage });
  if (errorMessage && filters.error !== "terminal-login") toastItems.push({ id: "trade-error", tone: "error", message: errorMessage });
  const selectedPrice = Number(terminal.executionInstrument?.price ?? terminal.selectedInstrument?.price ?? 0);
  const tickSize = Number(terminal.executionInstrument?.tickSize ?? terminal.selectedInstrument?.tickSize ?? (symbol === "NQ" || symbol === "ES" ? 0.25 : 1));
  const tickValue = Number(terminal.executionInstrument?.tickValue ?? terminal.selectedInstrument?.tickValue ?? 1);
  const depthRows = buildDepthRows(selectedPrice || 0, tickSize || 1);
  const maxContracts = getMaxContractsForBalance(Number(terminal.activeAccount?.startingBalance ?? 0));
  const secondaryLastPrice = Number(terminal.watchlistItems.find((item) => item.symbol === secondarySymbol)?.price ?? 0);
  const chartBaseQuery = `&${accountQuery}tab=${encodeURIComponent(terminal.selectedTab)}&layout=${encodeURIComponent(layout)}`;
  const isAccountBreached = terminal.activeAccount?.accountState === "BREACHED";
  const tradeStatusLabel = terminal.activeAccount?.accountState ?? terminal.activeAccount?.status ?? "ACTIVE";
  const switchableAccounts = terminal.accounts.filter(
    (account) => account.tradingAccountId && account.accountState !== "BREACHED"
  );

  return (
    <SiteShell>
      <TradeAutoRefresh enabled={hasTerminalAccess} />
      <FlashToast items={toastItems} />
      <TradeLiveProvider
        accountId={filters.accountId}
        initialState={{ activeAccount: terminal.activeAccount, positions: terminal.positions }}
      >
      <main className="trade-fullscreen-shell">
        <section className="trade-now-page">
          <section className="trade-now-topbar">
            <div className="trade-now-nav">
              <a href="/dashboard" className="trade-exit-link">Exit</a>
              <div className="trade-now-tabs">
                {quickSymbols.map((item) => (
                  <a
                    key={item.instrumentId}
                    href={`/dashboard/trades?${accountQuery}symbol=${encodeURIComponent(item.symbol)}&tab=${encodeURIComponent(terminal.selectedTab)}&timeframe=${encodeURIComponent(timeframe)}&layout=${encodeURIComponent(layout)}`}
                    className={`trade-now-tab${item.symbol === symbol ? " active" : ""}`}
                  >
                    {item.symbol}
                  </a>
                ))}
              </div>
            </div>
            <div className="trade-layout-tabs">
              <a href={`/dashboard/trades?${accountQuery}symbol=${encodeURIComponent(symbol)}&tab=${encodeURIComponent(terminal.selectedTab)}&timeframe=${encodeURIComponent(timeframe)}&layout=focus`} className={`trade-layout-tab${layout === "focus" ? " active" : ""}`}>Focus</a>
              <a href={`/dashboard/trades?${accountQuery}symbol=${encodeURIComponent(symbol)}&tab=${encodeURIComponent(terminal.selectedTab)}&timeframe=${encodeURIComponent(timeframe)}&layout=split`} className={`trade-layout-tab${layout === "split" ? " active" : ""}`}>Split ES/NQ</a>
            </div>
            <TradeAccountStatus initialAccount={terminal.activeAccount} mode="topbar" />
          </section>

          <section className="trade-now-shell">
            <aside className="trade-ladder-panel">
              <div className="trade-ladder-head">
                <div>
                  <strong>{symbol}6</strong>
                  <span>{terminal.selectedInstrument?.name ?? "Instrument"}</span>
                </div>
                <div className="trade-ladder-account">
                  <span>{tradeStatusLabel}</span>
                  <strong>{formatUsd(terminal.activeAccount?.buyingPower)}</strong>
                </div>
              </div>

              {terminal.activeAccount && terminal.selectedInstrument ? (
                <TradeTerminalControls
                  accountId={filters.accountId}
                  activeAccountId={terminal.activeAccount.id}
                  instrumentId={terminal.selectedInstrument.instrumentId}
                  symbol={symbol}
                  tab={terminal.selectedTab}
                  depthRows={depthRows}
                  defaultLimitPrice={String(terminal.selectedInstrument.price ?? "")}
                  maxContracts={maxContracts}
                  timeframe={timeframe}
                  layout={layout}
                  tradingLockedReason={isAccountBreached ? "Account breached. New trade entry is disabled." : null}
                />
              ) : null}

              <div className="trade-ladder-footer">
                <form action={createDemoAccountAction} className="trade-mini-form">
                  <input className="surface-input compact-input" name="accountName" placeholder="New demo" />
                  <button className="ghost-button compact-button" type="submit">Create</button>
                </form>
              </div>
            </aside>

            <section className="trade-main-panel">
              {isAccountBreached ? (
                <div className="trade-breach-banner">
                  <strong>Account breached</strong>
                  <span>Rule limits were exceeded. Trade entry is locked for this account.</span>
                </div>
              ) : null}
              <article className="trade-instrument-strip">
                <div className="trade-strip-symbol">
                  <strong>{symbol}</strong>
                  <span>{terminal.selectedInstrument?.name}</span>
                  <small>{formatWhole(maxContracts)} max contracts</small>
                </div>
                {terminal.activeAccount && terminal.selectedInstrument ? (
                  <TradeStripActions
                    accountId={filters.accountId}
                    demoAccountId={terminal.activeAccount.id}
                    instrumentId={terminal.selectedInstrument.instrumentId}
                    symbol={symbol}
                    tab={terminal.selectedTab}
                    maxContracts={maxContracts}
                    timeframe={timeframe}
                    layout={layout}
                    tradingLockedReason={isAccountBreached ? "Account breached. New trade entry is disabled." : null}
                    accountOptions={switchableAccounts.map((account) => ({
                      id: account.id,
                      accountName: account.accountName,
                      equity: account.equity,
                      href: `/dashboard/trades?accountId=${encodeURIComponent(account.tradingAccountId ?? "")}&symbol=${encodeURIComponent(symbol)}&tab=${encodeURIComponent(terminal.selectedTab)}&timeframe=${encodeURIComponent(timeframe)}&layout=${encodeURIComponent(layout)}`,
                      isActive: filters.accountId === account.tradingAccountId
                    }))}
                  />
                ) : null}
                <div className="trade-strip-metrics">
                  <div><span>Exec</span><strong>{formatPrice(terminal.executionInstrument?.price ?? terminal.selectedInstrument?.price)}</strong></div>
                  <div><span>Chart</span><strong>{formatPrice(terminal.selectedInstrument?.price)}</strong></div>
                  <div><span>Capacity</span><strong>{formatWhole(maxContracts)}</strong></div>
                  <div><span>Change</span><strong className={Number(terminal.selectedInstrument?.changeAmount ?? 0) >= 0 ? "positive" : "negative"}>{formatSigned(terminal.selectedInstrument?.changeAmount)}</strong></div>
                  <div><span>Position</span><strong>{terminal.positions.find((p) => p.symbol === symbol)?.quantity ?? 0}</strong></div>
                </div>
              </article>

              <article className="trade-chart-panel">
                <div className="trade-chart-frame">
                  {layout === "split" ? (
                    <div className="trade-chart-split">
                      <LiveChart
                        symbol={symbol}
                        initialCandles={initialCandles}
                        lastPrice={initialLastPrice}
                        change={Number(terminal.selectedInstrument?.changeAmount ?? 0)}
                        linkedSymbols={quickSymbols.map((item) => item.symbol)}
                        initialTimeframe={timeframe}
                        compact
                        baseQuery={chartBaseQuery}
                      />
                      <LiveChart
                        symbol={secondarySymbol}
                        initialCandles={secondaryChart.candles}
                        lastPrice={Number(secondaryChart.lastPrice || secondaryLastPrice || 0)}
                        change={Number(terminal.watchlistItems.find((item) => item.symbol === secondarySymbol)?.changeAmount ?? 0)}
                        linkedSymbols={quickSymbols.map((item) => item.symbol)}
                        initialTimeframe={timeframe}
                        compact
                        showLinkedSymbols={false}
                        baseQuery={chartBaseQuery}
                      />
                    </div>
                  ) : (
                    <LiveChart
                      symbol={symbol}
                      initialCandles={initialCandles}
                      lastPrice={initialLastPrice}
                      change={Number(terminal.selectedInstrument?.changeAmount ?? 0)}
                      linkedSymbols={quickSymbols.map((item) => item.symbol)}
                      initialTimeframe={timeframe}
                      baseQuery={chartBaseQuery}
                    />
                  )}
                </div>
              </article>

              <section className="trade-lower-grid">
                <article className="trade-market-panel">
                  <div className="trade-panel-title">
                    <strong>Indices</strong>
                    <span>ES / NQ focus</span>
                  </div>
                  <div className="trade-market-table">
                    <div className="trade-market-head">
                      <span>Symbol</span><span>Last</span><span>Change</span><span>Bid</span><span>Ask</span>
                    </div>
                    {terminal.watchlistItems.map((item) => (
                      <a key={item.instrumentId} href={`/dashboard/trades?${accountQuery}symbol=${encodeURIComponent(item.symbol)}&tab=${encodeURIComponent(terminal.selectedTab)}&timeframe=${encodeURIComponent(timeframe)}&layout=${encodeURIComponent(layout)}`} className="trade-market-row">
                        <span>{item.symbol}</span>
                        <span>{formatPrice(item.price)}</span>
                        <span className={Number(item.changeAmount ?? 0) >= 0 ? "positive" : "negative"}>{formatSigned(item.changeAmount)}</span>
                        <span>{formatPrice(Number(item.price ?? 0) - tickSize)}</span>
                        <span>{formatPrice(Number(item.price ?? 0) + tickSize)}</span>
                      </a>
                    ))}
                  </div>
                </article>

                <article className="trade-blotter-panel">
                  <div className="trade-tabs compact">
                    {["orders", "positions", "fills", "history"].map((tab) => (
                      <a key={tab} href={`/dashboard/trades?${accountQuery}symbol=${encodeURIComponent(symbol)}&tab=${tab}&timeframe=${encodeURIComponent(timeframe)}&layout=${encodeURIComponent(layout)}`} className={`trade-tab${terminal.selectedTab === tab ? " active" : ""}`}>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </a>
                    ))}
                  </div>

                  {terminal.selectedTab === "orders" ? (
                    <div className="trade-table terminal">
                      <div className="trade-table-head">
                        <span>Action</span><span>Qty</span><span>Type</span><span>Price</span><span>Status</span><span>Time</span>
                      </div>
                      {terminal.orders.length ? terminal.orders.map((order) => (
                        <div key={order.id} className="trade-table-row">
                          <span>{order.side} {order.symbol}</span>
                          <span>{order.quantity}</span>
                          <span>{order.type}</span>
                          <span>{order.limitPrice ?? order.averageFillPrice ?? "-"}</span>
                          <span>{order.status}</span>
                          <span>{new Date(order.createdAt).toLocaleTimeString("en-GB")}</span>
                          {order.status === "WORKING" ? (
                            <form action={cancelDemoOrderAction}>
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="symbol" value={symbol} />
                              <input type="hidden" name="tab" value="orders" />
                              <input type="hidden" name="accountId" value={filters.accountId ?? ""} />
                              <input type="hidden" name="timeframe" value={timeframe} />
                              <input type="hidden" name="layout" value={layout} />
                              <ConfirmButton className="trade-cancel-button" label="Cancel" message="Cancel this working order?" />
                            </form>
                          ) : (
                            <span>-</span>
                          )}
                        </div>
                      )) : <div className="trade-empty">No orders yet.</div>}
                    </div>
                  ) : null}

                  {terminal.selectedTab === "positions" ? (
                    <PositionsTable
                      accountId={filters.accountId}
                      demoAccountId={terminal.activeAccount?.id ?? ""}
                      symbol={symbol}
                      timeframe={timeframe}
                      layout={layout}
                      positions={terminal.positions}
                    />
                  ) : null}

                  {terminal.selectedTab === "fills" ? (
                    <div className="trade-table terminal">
                      <div className="trade-table-head">
                        <span>Symbol</span><span>Side</span><span>Qty</span><span>Fill</span><span>Realized</span><span>Time</span>
                      </div>
                      {terminal.fills.length ? terminal.fills.map((fill) => (
                        <div key={fill.id} className="trade-table-row">
                          <span>{fill.symbol}</span>
                          <span>{fill.side}</span>
                          <span>{fill.quantity}</span>
                          <span>{fill.price}</span>
                          <span className={Number(fill.realizedPnl) >= 0 ? "positive" : "negative"}>{formatUsd(fill.realizedPnl)}</span>
                          <span>{new Date(fill.filledAt).toLocaleTimeString("en-GB")}</span>
                        </div>
                      )) : <div className="trade-empty">No fills yet.</div>}
                    </div>
                  ) : null}

                  {terminal.selectedTab === "history" ? (
                    <div className="trade-table terminal">
                      <div className="trade-table-head trade-table-row-activity">
                        <span>Order</span><span>Outcome</span><span>Time</span>
                      </div>
                      {terminal.history.length ? terminal.history.map((entry) => (
                        <div key={entry.id} className="trade-table-row trade-table-row-activity">
                          <span>{entry.side} {entry.quantity} {entry.symbol}</span>
                          <span className="trade-history-outcome">
                            {entry.status === "FILLED" ? (
                              <>
                                <span className="trade-history-text">Closed {entry.type.toLowerCase()} @ {entry.price ?? "-"}</span>
                                <strong className={`trade-history-pnl ${Number(entry.realizedPnl ?? 0) >= 0 ? "positive" : "negative"}`}>
                                  {formatUsd(entry.realizedPnl ?? 0)}
                                </strong>
                              </>
                            ) : (
                              <span className="trade-history-text">Canceled {entry.type.toLowerCase()} order</span>
                            )}
                          </span>
                          <span>{new Date(entry.createdAt).toLocaleTimeString("en-GB")}</span>
                        </div>
                      )) : <div className="trade-empty">No history yet.</div>}
                    </div>
                  ) : null}
                </article>
              </section>
            </section>

            <aside className="trade-control-panel">
              <div className="trade-panel-title">
                <strong>Account Details</strong>
                <span>Trade Now</span>
              </div>
              <TradeAccountStatus initialAccount={terminal.activeAccount} mode="risk" />
            </aside>
          </section>
        </section>
      </main>
      </TradeLiveProvider>
    </SiteShell>
  );
}
