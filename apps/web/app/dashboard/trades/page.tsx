import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession, logoutAction } from "../../../lib/auth";
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
import { showcaseWorkspace } from "../../../lib/showcase-workspace";

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

function renderEmptyTradeNowState() {
  return (
    <SiteShell>
      <main className="trade-terminal-login-shell">
        <section className="trade-terminal-login-card">
          <div className="trade-terminal-login-brand">
            <span className="trade-terminal-login-mark" />
            <strong>fundedpro terminal</strong>
          </div>
          <p className="trade-terminal-login-copy">Trade Now unlocks after your first challenge account is provisioned. Once checkout completes, this terminal will use your dedicated trading login instead of your website password.</p>
          <div className="trade-terminal-login-help" style={{ justifyContent: "space-between", gap: "12px" }}>
            <a href="/checkout">Buy Challenge</a>
            <a href="/dashboard/account">Account Detail</a>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

function renderShowcaseTradeWorkspace(session: Awaited<ReturnType<typeof getSession>>, tab: string | undefined) {
  const account = showcaseWorkspace;
  const isHistoryTab = tab === "history";
  const candles = [
    { left: "1.5%", bottom: "66%", height: "8%", wick: "14%", tone: "green" },
    { left: "3.8%", bottom: "63%", height: "5%", wick: "11%", tone: "green" },
    { left: "6.1%", bottom: "58%", height: "10%", wick: "16%", tone: "red" },
    { left: "8.7%", bottom: "54%", height: "7%", wick: "13%", tone: "red" },
    { left: "11.2%", bottom: "49%", height: "9%", wick: "15%", tone: "green" },
    { left: "14%", bottom: "41%", height: "13%", wick: "18%", tone: "red" },
    { left: "17.4%", bottom: "46%", height: "8%", wick: "12%", tone: "green" },
    { left: "20.3%", bottom: "52%", height: "6%", wick: "10%", tone: "green" },
    { left: "23.7%", bottom: "60%", height: "5%", wick: "9%", tone: "green" },
    { left: "27.4%", bottom: "61%", height: "7%", wick: "12%", tone: "red" },
    { left: "31.1%", bottom: "56%", height: "10%", wick: "16%", tone: "red" },
    { left: "34.5%", bottom: "48%", height: "11%", wick: "18%", tone: "green" },
    { left: "38.6%", bottom: "44%", height: "8%", wick: "13%", tone: "green" },
    { left: "42.2%", bottom: "50%", height: "7%", wick: "11%", tone: "red" },
    { left: "46%", bottom: "57%", height: "6%", wick: "10%", tone: "green" },
    { left: "49.5%", bottom: "63%", height: "7%", wick: "12%", tone: "green" },
    { left: "53.6%", bottom: "54%", height: "14%", wick: "20%", tone: "red" },
    { left: "57.7%", bottom: "40%", height: "18%", wick: "24%", tone: "green" },
    { left: "61.4%", bottom: "47%", height: "10%", wick: "16%", tone: "green" },
    { left: "65.3%", bottom: "38%", height: "16%", wick: "21%", tone: "red" },
    { left: "69.2%", bottom: "29%", height: "20%", wick: "28%", tone: "green" },
    { left: "73.1%", bottom: "37%", height: "11%", wick: "18%", tone: "red" },
    { left: "77%", bottom: "31%", height: "9%", wick: "14%", tone: "red" },
    { left: "80.8%", bottom: "26%", height: "8%", wick: "12%", tone: "red" },
    { left: "84.2%", bottom: "22%", height: "7%", wick: "12%", tone: "green" },
    { left: "87.4%", bottom: "24%", height: "6%", wick: "10%", tone: "green" },
    { left: "90.6%", bottom: "19%", height: "9%", wick: "14%", tone: "red" },
    { left: "93.5%", bottom: "11%", height: "11%", wick: "16%", tone: "red" },
    { left: "96.2%", bottom: "8%", height: "8%", wick: "13%", tone: "red" },
    { left: "98.4%", bottom: "5%", height: "6%", wick: "10%", tone: "green" }
  ];
  const ambientChips = [
    { className: "chip-one", label: "Execution-ready", value: "Buy / Sell in one strip" },
    { className: "chip-two", label: "Risk visible", value: "Equity and buying power pinned" },
    { className: "chip-three", label: "Chart range", value: "1m to 1w views" },
    { className: "chip-four", label: "Desk flow", value: "Ladder, chart, blotter aligned" }
  ];

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand">
            <p className="eyebrow">Trader workspace</p>
            <h2 className="sidebar-title">FundedPro</h2>
            <p className="surface-copy">Showcase mode keeps the full terminal and trade-history design visible until your first live challenge account is provisioned.</p>
          </div>
          <nav className="sidebar-nav">
            <a className="sidebar-link sidebar-link-gold" href="/checkout">New Challenge</a>
            <a className={`sidebar-link${isHistoryTab ? "" : " active"}`} href="/dashboard/trades">Trade Now</a>
            <a className="sidebar-link" href="/dashboard">Overview</a>
            <a className="sidebar-link" href="/dashboard/account">Account detail</a>
            <a className={`sidebar-link${isHistoryTab ? " active" : ""}`} href="/dashboard/trades?tab=history">Trade history</a>
            <a className="sidebar-link" href="/dashboard/billing">Billing</a>
            <a className="sidebar-link" href="/dashboard/payouts">Payouts</a>
            <a className="sidebar-link" href="/dashboard/support">Support</a>
            <a className="sidebar-link" href="/login">Switch account</a>
            {session?.role === "ADMIN" ? <a className="sidebar-link" href="/admin">Admin panel</a> : null}
          </nav>
          <form action={logoutAction}>
            <button className="ghost-button" type="submit">Log out</button>
          </form>
        </aside>

        <section className="dashboard-main account-page">
          {isHistoryTab ? (
            <>
              <section className="dashboard-hero">
                <div className="hero-stack">
                  <div>
                    <p className="eyebrow">Trade history</p>
                    <h1 className="page-title">Closed trades and open positions</h1>
                    <p className="page-copy">This showcase history view matches the designed funded workspace until a real challenge account starts producing live trades.</p>
                  </div>
                  <div className="hero-inline-metrics">
                    <article className="inline-metric">
                      <span>Total trades</span>
                      <strong>{account.totalTrades}</strong>
                    </article>
                    <article className="inline-metric">
                      <span>Win rate</span>
                      <strong>{account.winRate}%</strong>
                    </article>
                    <article className="inline-metric">
                      <span>Average hold</span>
                      <strong>{account.avgHoldingMinutes}m</strong>
                    </article>
                  </div>
                </div>
              </section>

              <section className="account-detail-grid wide-gap">
                <article className="table-card">
                  <div className="table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Side</th>
                          <th>Open</th>
                          <th>Close</th>
                          <th>Realized</th>
                          <th>Closed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account.closedTrades.map((trade, index) => (
                          <tr key={`${trade.symbol}-${index}`}>
                            <td>{trade.symbol}</td>
                            <td>{trade.side}</td>
                            <td>{trade.openPrice}</td>
                            <td>{trade.closePrice}</td>
                            <td>{trade.realized}</td>
                            <td>{trade.closed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
                <article className="surface-card emphasis-card">
                  <span className="muted-label">Open positions</span>
                  <div className="session-table">
                    {account.positions.map((position) => (
                      <div className="session-row" key={position.symbol}>
                        <span>{position.symbol}</span>
                        <strong>{position.pnl}</strong>
                        <span>{position.detail}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            </>
          ) : (
            <section className="trade-now-showcase">
              <div className="trade-now-showcase-copy">
                <p className="eyebrow">Inside Trade Now</p>
                <h2 className="section-title">
                  A picture of our{" "}
                  <span className="accent-text">actual Trade Now layout</span>
                </h2>
                <p className="section-copy">
                  The main terminal is laid out so execution, chart context, and account risk all stay visible on one screen.
                </p>
              </div>

              <div className="trade-now-shot">
                <div className="trade-now-shot-canvas" aria-label="FundedPro Trade Now screenshot style preview">
                  <div className="trade-now-shot-header">
                    <div className="trade-now-shot-left-title">
                      <strong>ES6</strong>
                      <span>E-mini S&amp;P 500</span>
                    </div>
                    <div className="trade-now-shot-status">
                      <span>Evaluation</span>
                      <strong>{formatUsd(account.accountSize)}</strong>
                    </div>
                    <div className="trade-now-shot-toolbar">
                      <div className="trade-now-shot-size">1</div>
                      <button type="button" className="buy">BUY</button>
                      <button type="button" className="sell">SELL</button>
                      <button type="button" className="accounts">Accounts</button>
                    </div>
                    <div className="trade-now-shot-metrics">
                      <span>Exec</span>
                      <strong>4,914.50</strong>
                      <span>Chart</span>
                      <strong>6,506.48</strong>
                    </div>
                  </div>

                  <div className="trade-now-shot-body">
                    <aside className="trade-now-shot-ladder">
                      <div className="trade-now-shot-sidecard">
                        <strong>#{account.login}</strong>
                        <span>Showcase terminal</span>
                        <small>Max 10 ctr</small>
                      </div>
                      <div className="trade-now-shot-form">
                        <label><span>Qty</span><div>1</div></label>
                        <label><span>Type</span><div>Mkt</div></label>
                        <label><span>TIF</span><div>DAY</div></label>
                        <label><span>ATM</span><div>OFF</div></label>
                      </div>
                      <div className="trade-now-shot-book">
                        {["4916.50","4916.25","4916.00","4915.75","4915.50","4915.25","4915.00","4914.75","4914.50","4914.25"].map((price, index) => (
                          <div key={price} className="trade-now-shot-book-row">
                            <span className="bid">{price}</span>
                            <strong>{price}</strong>
                            <span className="ask">{11 - index}</span>
                          </div>
                        ))}
                      </div>
                    </aside>

                    <main className="trade-now-shot-main">
                      <div className="trade-now-shot-timeframes">
                        {["ES", "NQ", "1m", "5m", "15m", "1h", "1d", "1w"].map((item) => (
                          <span key={item} className={item === "5m" ? "active" : ""}>{item}</span>
                        ))}
                      </div>

                      <div className="trade-now-shot-chart">
                        <div className="trade-now-shot-grid" />
                        <div className="trade-now-shot-chart-glow" />
                        <div className="trade-now-shot-chart-vignette" />
                        <div className="trade-now-shot-chart-header">
                          <strong>6506.48</strong>
                          <span>+0.00</span>
                        </div>
                        <div className="trade-now-shot-candles">
                          {candles.map((candle, index) => (
                            <span
                              key={`${candle.left}-${index}`}
                              className={`trade-now-shot-candle ${candle.tone}`}
                              style={{
                                left: candle.left,
                                bottom: candle.bottom,
                                height: candle.height,
                                ["--wick-height" as string]: candle.wick,
                                animationDelay: `${index * 0.08}s`
                              }}
                            />
                          ))}
                        </div>
                        <div className="trade-now-shot-chart-price-line" />
                        <div className="trade-now-shot-chart-line" />
                        <div className="trade-now-shot-chart-line overlay" />
                        <div className="trade-now-shot-chart-axis">
                          {["7100", "7050", "7000", "6950", "6900", "6850", "6800", "6750", "6700", "6650", "6600", "6550", "6500", "6450"].map((level) => (
                            <span key={level}>{level}</span>
                          ))}
                        </div>
                        <div className="trade-now-shot-chart-timeline">
                          {["Feb", "5", "10", "13", "19", "24", "Mar", "5", "10", "13", "18", "18:00"].map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                        </div>
                        <div className="trade-now-shot-last">6506.48</div>
                        <div className="trade-now-shot-chart-scan" />
                      </div>

                      <div className="trade-now-shot-bottom">
                        <section className="trade-now-shot-market">
                          <strong>Indices</strong>
                          <div className="trade-now-shot-table">
                            <span>ES</span><span>6,506.48</span><span className="negative">-372.01</span>
                            <span>NQ</span><span>23,898.15</span><span className="negative">-1,563.55</span>
                            <span>CL</span><span>79.85</span><span className="positive">+0.02</span>
                            <span>GC</span><span>2,063.30</span><span className="positive">+0.70</span>
                          </div>
                        </section>

                        <section className="trade-now-shot-blotter">
                          <div className="trade-now-shot-tabs">
                            <span>Orders</span>
                            <span className="active">Positions</span>
                            <span>Fills</span>
                            <span>History</span>
                          </div>
                          <div className="trade-now-shot-empty">
                            {account.positions.length
                              ? `${account.positions[0]?.symbol} ${account.positions[0]?.detail}, ${account.positions[0]?.pnl}`
                              : "No positions yet."}
                          </div>
                        </section>
                      </div>
                    </main>

                    <aside className="trade-now-shot-risk">
                      <strong>Account Details</strong>
                      <small>Trade now</small>
                      <div className="trade-now-shot-risk-grid">
                        <div><span>Buying power</span><strong>{formatUsd(account.accountSize)}</strong></div>
                        <div><span>Equity</span><strong>{formatUsd(account.equity)}</strong></div>
                        <div><span>Realized</span><strong>{formatUsd(account.pnl)}</strong></div>
                        <div><span>Unrealized</span><strong className="positive">$125.00</strong></div>
                      </div>
                    </aside>
                  </div>

                  <div className="trade-now-pointer pointer-toolbar">
                    <span className="line h" />
                    <span className="dot" />
                    <div className="label">
                      <strong>Buy / Sell strip</strong>
                      <p>Fast execution controls with account switching.</p>
                    </div>
                  </div>

                  <div className="trade-now-pointer pointer-ladder">
                    <span className="line h" />
                    <span className="dot" />
                    <div className="label">
                      <strong>Ladder and ticket</strong>
                      <p>Quantity, order type, TIF, and live pricing depth.</p>
                    </div>
                  </div>

                  <div className="trade-now-pointer pointer-chart">
                    <span className="line v" />
                    <span className="dot" />
                    <div className="label">
                      <strong>Main chart area</strong>
                      <p>Symbol toggles and timeframes sit directly above the chart.</p>
                    </div>
                  </div>

                  <div className="trade-now-pointer pointer-risk">
                    <span className="line h reverse" />
                    <span className="dot" />
                    <div className="label">
                      <strong>Account details</strong>
                      <p>Buying power, equity, and P&amp;L stay visible at all times.</p>
                    </div>
                  </div>

                  <div className="trade-now-pointer pointer-blotter">
                    <span className="line v up" />
                    <span className="dot" />
                    <div className="label">
                      <strong>Blotter and market panels</strong>
                      <p>Orders, fills, history, and market context sit below the chart.</p>
                    </div>
                  </div>

                  {ambientChips.map((chip) => (
                    <div key={chip.className} className={`trade-now-ambient-chip ${chip.className}`}>
                      <small>{chip.label}</small>
                      <strong>{chip.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}

export default async function TradeNowPage({ searchParams }: TradeNowPageProps) {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fdashboard%2Ftrades");

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
  const loginErrorMessage = filters.error === "terminal-login" ? errorMessage : null;

  if (!hasTerminalAccess) {
    const db = getDb();
    const userAccounts = await db.query<{ id: string }>(
      `
        SELECT "id"
        FROM "TradingAccount"
        WHERE "userId" = $1
        LIMIT 1
      `,
      [session.userId]
    );

    if (!userAccounts.rowCount) {
      return renderShowcaseTradeWorkspace(session, filters.tab);
    }

    return (
      <SiteShell>
        <main className="trade-terminal-login-shell">
          <section className="trade-terminal-login-card">
            <div className="trade-terminal-login-brand">
              <span className="trade-terminal-login-mark" />
              <strong>fundedpro terminal</strong>
            </div>
            <p className="trade-terminal-login-copy">Use the trading login and password from your account-ready email or the account detail page. This screen does not use your main FundedPro website password.</p>
            {loginErrorMessage ? <div className="trade-terminal-login-error">{loginErrorMessage}</div> : null}
            <form action={unlockDemoTerminalAction} className="trade-terminal-login-form">
              <input type="hidden" name="accountId" value={filters.accountId ?? ""} />
              <input type="hidden" name="symbol" value={filters.symbol ?? ""} />
              <input type="hidden" name="tab" value={filters.tab ?? ""} />
              <input type="hidden" name="timeframe" value={filters.timeframe ?? ""} />
              <input type="hidden" name="layout" value={filters.layout ?? ""} />
              <label>
                <span>Login</span>
                <input name="username" type="text" placeholder={session.email} autoComplete="username" defaultValue={rememberedTerminal?.login ?? ""} />
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" placeholder="Enter password" autoComplete="current-password" defaultValue={rememberedTerminal?.password ?? ""} />
              </label>
              <label>
                <input name="rememberMe" type="checkbox" defaultChecked={Boolean(rememberedTerminal)} />
                <span>Remember me</span>
              </label>
              <button type="submit" className="trade-terminal-login-submit">Login</button>
            </form>
            <div className="trade-terminal-login-help">
              <a href="/dashboard">Back to dashboard</a>
            </div>
          </section>
        </main>
      </SiteShell>
    );
  }

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
                    {item.symbol}6
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
                  <strong>{symbol}6</strong>
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
