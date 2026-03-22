import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { getChallengeSnapshot } from "@fundedpro/domain";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { FlashToast } from "../../components/flash-toast";
import { getSession, logoutAction } from "../../../lib/auth";
import { getInternalTradingSnapshot, syncUserTradingAccountsFromDemo } from "../../../lib/internal-trading-sync";
import { ensureOwnerShowcaseWorkspace } from "../../../lib/owner-showcase";
import { decryptTradingPassword } from "../../../lib/trading-credentials";
import { showcaseWorkspace } from "../../../lib/showcase-workspace";

export const dynamic = "force-dynamic";

function formatUsd(value: string | number | undefined) {
  return Number(value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function formatPct(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toChartY(value: number, min: number, max: number) {
  const normalized = (value - min) / Math.max(max - min, 1);
  return 88 - (normalized * 76);
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function buildMonthGrid(entries: Map<string, number>, focusDate: Date) {
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ label: string; pnl: number | null; active: boolean }> = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ label: "", pnl: null, active: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${month + 1}-${day}`;
    cells.push({
      label: String(day),
      pnl: entries.get(key) ?? null,
      active: true
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ label: "", pnl: null, active: false });
  }

  return cells;
}

function getDisplayName(fullName: string, email: string) {
  const trimmed = fullName.trim();
  return trimmed || email.split("@")[0] || "Trader";
}

function getTierLabel(balance: number) {
  if (balance >= 250000) return "Master";
  if (balance >= 100000) return "Practitioner";
  return "Student";
}

function getStateTone(state: string) {
  if (state === "FUNDED" || state === "PASSED") return "success";
  if (state === "FAILED" || state === "BREACHED") return "danger";
  if (state === "REVIEW") return "info";
  return "active";
}

function getDisplayState(account: {
  accountState: string;
  breachedAt: Date | null;
  passedAt: Date | null;
  fundedAt: Date | null;
  reviewQueuedAt: Date | null;
}) {
  if (account.fundedAt || account.accountState === "FUNDED") return "FUNDED";
  if (account.passedAt || account.accountState === "PASSED") return "PASSED";
  if (account.breachedAt || account.accountState === "FAILED" || account.accountState === "BREACHED") return "FAILED";
  if (account.reviewQueuedAt || account.accountState === "REVIEW") return "REVIEW";
  return "EVALUATION";
}

function renderShowcaseAccountDetail(session: Awaited<ReturnType<typeof getSession>>, displayName: string) {
  const account = showcaseWorkspace;

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand">
            <p className="eyebrow">Trader workspace</p>
            <h2 className="sidebar-title">FundedPro</h2>
            <p className="surface-copy">Account detail stays in showcase mode until your first live challenge provisions a dedicated trading login.</p>
          </div>
          <nav className="sidebar-nav">
            <a className="sidebar-link sidebar-link-gold" href="/checkout">New Challenge</a>
            <a className="sidebar-link" href="/dashboard/trades">Trade Now</a>
            <a className="sidebar-link" href="/dashboard">Overview</a>
            <a className="sidebar-link active" href="/dashboard/account">Account detail</a>
            <a className="sidebar-link" href="/dashboard/trades?tab=history">Trade history</a>
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

        <section className="dashboard-main account-page account-page-fixed">
          <section className="account-browser">
            <div className="account-browser-list">
              <div className="account-browser-header">
                <a href="/checkout" className="account-browser-buy">Buy Challenge</a>
              </div>
              <div className="account-browser-filters">
                <span className="account-browser-filter">One Step</span>
                <span className="account-browser-filter">Ongoing</span>
                <span className="account-browser-filter">Showcase</span>
              </div>
              <div className="account-browser-cards">
                <a href="/dashboard/account" className="account-browser-card active">
                  <div className="account-browser-card-head">
                    <div className="account-browser-card-title">
                      <span className="account-browser-card-icon" aria-hidden="true" />
                      <strong>#{account.login}</strong>
                    </div>
                    <div className="account-browser-card-actions">
                      <span className="account-browser-state active">Ongoing</span>
                      <span className="account-browser-more" aria-hidden="true">...</span>
                    </div>
                  </div>
                  <p className="account-browser-meta">
                    {formatUsd(account.accountSize).replace(".00", "")} <span>&bull;</span> One Step <span>&bull;</span> Practitioner
                  </p>
                  <div className="account-browser-grid">
                    <div>
                      <span>Balance</span>
                      <strong>{formatUsd(account.balance)}</strong>
                    </div>
                    <div>
                      <span>Profit Target (8%)</span>
                      <strong>{account.progressPct}%</strong>
                    </div>
                    <div>
                      <span>P&amp;L</span>
                      <strong className="positive">+{formatUsd(account.pnl)}</strong>
                    </div>
                    <div>
                      <span>Profit %</span>
                      <strong className="positive">+4.4%</strong>
                    </div>
                  </div>
                  <div className="account-browser-progress">
                    <span style={{ width: `${account.progressPct}%` }} />
                  </div>
                </a>
              </div>
            </div>

            <div className="account-browser-detail">
              <div className="account-detail-panel">
                <div className="account-detail-top">
                  <div>
                    <p className="eyebrow">Account detail</p>
                    <h2 className="page-title account-detail-title">#{account.login}</h2>
                    <p className="page-copy">The showcase workspace mirrors the designed FundedPro account detail experience until your first live challenge provisions a real account.</p>
                  </div>
                  <div className="account-detail-top-actions">
                    <span className="account-browser-state active">Showcase</span>
                  </div>
                </div>

                <div className="account-detail-metrics">
                  <article className="surface-card metric-panel">
                    <span className="muted-label">Trader</span>
                    <strong className="metric-value">{displayName}</strong>
                    <p className="surface-copy">Preview workspace owner</p>
                  </article>
                  <article className="surface-card metric-panel">
                    <span className="muted-label">Balance</span>
                    <strong className="metric-value">{formatUsd(account.balance)}</strong>
                    <p className="surface-copy">Equity {formatUsd(account.equity)}</p>
                  </article>
                  <article className="surface-card metric-panel">
                    <span className="muted-label">Total Reward</span>
                    <strong className="metric-value">{formatUsd(account.totalRewardCents / 100)}</strong>
                    <p className="surface-copy">{account.rewardCount} certificates unlocked</p>
                  </article>
                </div>

                <section className="account-section">
                  <div className="detail-head">
                    <div>
                      <span className="muted-label">Trading objectives</span>
                      <strong className="metric-value">Rule progress</strong>
                    </div>
                  </div>
                  <div className="account-objective-list">
                    <article className="surface-card account-objective-card">
                      <div className="account-objective-head"><strong>Minimum Trading Days</strong><span>Progress: 100.00%</span></div>
                      <p>5 of 5 trading days completed</p>
                      <div className="progress-track"><span className="progress-fill" style={{ width: "100%" }} /></div>
                    </article>
                    <article className="surface-card account-objective-card">
                      <div className="account-objective-head"><strong>Maximum Daily Loss</strong><span>Remaining: {formatUsd(3200)}</span></div>
                      <p>Maximum allowed daily loss: {formatUsd(4000)}</p>
                      <div className="progress-track"><span className="progress-fill" style={{ width: "80%" }} /></div>
                    </article>
                    <article className="surface-card account-objective-card">
                      <div className="account-objective-head"><strong>Maximum Loss</strong><span>Remaining: {formatUsd(7600)}</span></div>
                      <p>Maximum allowed loss: {formatUsd(10000)}</p>
                      <div className="progress-track"><span className="progress-fill" style={{ width: "76%" }} /></div>
                    </article>
                    <article className="surface-card account-objective-card">
                      <div className="account-objective-head"><strong>Profit Target</strong><span>{formatUsd(account.pnl)} of {formatUsd(8000)}</span></div>
                      <p>Track progress toward the active profit objective.</p>
                      <div className="progress-track"><span className="progress-fill" style={{ width: `${account.progressPct}%` }} /></div>
                    </article>
                  </div>
                </section>

                <section className="account-detail-metrics four-up">
                  <article className="surface-card metric-panel">
                    <span className="muted-label">Win rate</span>
                    <strong className="metric-value">{formatPct(account.winRate)}</strong>
                  </article>
                  <article className="surface-card metric-panel">
                    <span className="muted-label">Average hold</span>
                    <strong className="metric-value">{Math.round(account.avgHoldingMinutes)}m</strong>
                  </article>
                  <article className="surface-card metric-panel">
                    <span className="muted-label">Won trades</span>
                    <strong className="metric-value positive">{account.wonTrades}</strong>
                  </article>
                  <article className="surface-card metric-panel">
                    <span className="muted-label">Lost trades</span>
                    <strong className="metric-value">{account.lostTrades}</strong>
                  </article>
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
              </div>
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}

type AccountPageProps = {
  searchParams: Promise<{ accountId?: string; provisioned?: string }>;
};

export default async function AccountDetailPage({ searchParams }: AccountPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  await ensureOwnerShowcaseWorkspace(session.userId, session.email);

  const { accountId, provisioned } = await searchParams;
  const db = getDb();
  await syncUserTradingAccountsFromDemo(session.userId);

  const [userResult, accountResult, orderResult] = await Promise.all([
    db.query<{ id: string; fullName: string }>('SELECT "id", "fullName" FROM "User" WHERE "id" = $1 LIMIT 1', [session.userId]),
    db.query<{
      id: string;
      login: string;
      tradingPassword: string | null;
      platform: string;
      connection: string;
      credentialsIssuedAt: Date | null;
      accountState: string;
      currentPhase: number;
      provider: string;
      startingBalance: string;
      phaseStartBalance: string;
      currentBalance: string;
      currentEquity: string;
      tradingDays: number;
      profitTarget: string;
      dailyLossLimit: string;
      totalLossLimit: string;
      reviewQueuedAt: Date | null;
      passedAt: Date | null;
      fundedAt: Date | null;
      breachedAt: Date | null;
      createdAt: Date;
    }>(
      `
        SELECT
          "id", "login", "tradingPassword", "accountState", "currentPhase", "provider", "startingBalance", "phaseStartBalance",
          "platform", "connection", "credentialsIssuedAt",
          "currentBalance", "currentEquity", "tradingDays", "profitTarget", "dailyLossLimit", "totalLossLimit",
          "reviewQueuedAt", "passedAt", "fundedAt", "breachedAt", "createdAt"
        FROM "TradingAccount"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC
      `,
      [session.userId]
    ),
    db.query<{ accountSize: number; phaseCount: number; minTradingDays: number }>(
      `
        SELECT cp."accountSize", cp."phaseCount", cp."minTradingDays"
        FROM "ChallengeOrder" co
        JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
        WHERE co."userId" = $1
        ORDER BY co."createdAt" DESC
        LIMIT 1
      `,
      [session.userId]
    )
  ]);

  const user = userResult.rows[0];
  const plan = orderResult.rows[0];

  if (!user) {
    redirect("/login");
  }

  if (!accountResult.rows.length) {
    return renderShowcaseAccountDetail(session, getDisplayName(user.fullName, session.email));
  }

  const accounts = accountResult.rows.map((account) => {
    const snapshot = getChallengeSnapshot({
      startingBalance: Number(account.startingBalance),
      phaseStartBalance: Number(account.phaseStartBalance),
      currentBalance: Number(account.currentBalance),
      currentEquity: Number(account.currentEquity),
      profitTarget: Number(account.profitTarget),
      dailyLossLimit: Number(account.dailyLossLimit),
      totalLossLimit: Number(account.totalLossLimit),
      tradingDays: account.tradingDays,
      minTradingDays: plan?.minTradingDays ?? 3,
      accountState: account.accountState,
      currentPhase: account.currentPhase,
      phaseCount: plan?.phaseCount ?? 1
    });

    return {
      ...account,
      snapshot,
      displayState: getDisplayState(account),
      pnl: Number(account.currentBalance) - Number(account.startingBalance),
      progressPct: snapshot.targetProgressPct,
      phaseCount: plan?.phaseCount ?? 1
    };
  });

  const selectedAccount = accounts.find((account) => account.id === accountId) ?? accounts[0] ?? null;
  const toastItems = provisioned
    ? [{ id: "account-provisioned", tone: "success" as const, message: "Trading account provisioned. Your internal platform credentials have been emailed and your account is ready." }]
    : [];
  const displayName = getDisplayName(user.fullName, session.email);
  const selectedSnapshot = selectedAccount ? await getInternalTradingSnapshot(selectedAccount.id) : null;

  const detailAccount = selectedAccount
    ? (() => {
        const syncedBalance = selectedSnapshot?.balance ?? Number(selectedAccount.currentBalance);
        const syncedEquity = selectedSnapshot?.equity ?? Number(selectedAccount.currentEquity);
        const syncedTradingDays = selectedSnapshot?.tradingDays ?? selectedAccount.tradingDays;
        const syncedSnapshot = getChallengeSnapshot({
          startingBalance: Number(selectedAccount.startingBalance),
          phaseStartBalance: Number(selectedAccount.phaseStartBalance),
          currentBalance: syncedBalance,
          currentEquity: syncedEquity,
          profitTarget: Number(selectedAccount.profitTarget),
          dailyLossLimit: Number(selectedAccount.dailyLossLimit),
          totalLossLimit: Number(selectedAccount.totalLossLimit),
          tradingDays: syncedTradingDays,
          minTradingDays: plan?.minTradingDays ?? 3,
          accountState: selectedAccount.accountState,
          currentPhase: selectedAccount.currentPhase,
          phaseCount: plan?.phaseCount ?? 1
        });

        return {
          ...selectedAccount,
          currentBalance: syncedBalance,
          currentEquity: syncedEquity,
          tradingDays: syncedTradingDays,
          pnl: syncedBalance - Number(selectedAccount.startingBalance),
          snapshot: syncedSnapshot,
          progressPct: syncedSnapshot.targetProgressPct
        };
      })()
    : null;

  const snapshotHistory = selectedSnapshot?.history ?? [];
  const closedTrades = selectedSnapshot?.closedTrades ?? [];
  const positions = selectedSnapshot?.positions ?? [];
  const winCount = closedTrades.filter((trade) => trade.realizedPnl > 0).length;
  const lossCount = closedTrades.filter((trade) => trade.realizedPnl <= 0).length;
  const totalLots = closedTrades.reduce((sum, trade) => sum + trade.lots, 0);
  const biggestWin = closedTrades.reduce((best, trade) => Math.max(best, trade.realizedPnl), 0);
  const biggestLoss = closedTrades.reduce((worst, trade) => Math.min(worst, trade.realizedPnl), 0);
  const averageWin = winCount ? closedTrades.filter((trade) => trade.realizedPnl > 0).reduce((sum, trade) => sum + trade.realizedPnl, 0) / winCount : 0;
  const averageLoss = lossCount ? closedTrades.filter((trade) => trade.realizedPnl <= 0).reduce((sum, trade) => sum + trade.realizedPnl, 0) / lossCount : 0;
  const winRatio = closedTrades.length ? (winCount / closedTrades.length) * 100 : 0;
  const instrumentProfit = Array.from(
    closedTrades.reduce((map, trade) => {
      map.set(trade.symbol, (map.get(trade.symbol) ?? 0) + trade.realizedPnl);
      return map;
    }, new Map<string, number>())
  );
  const instrumentLots = Array.from(
    closedTrades.reduce((map, trade) => {
      map.set(trade.symbol, (map.get(trade.symbol) ?? 0) + trade.lots);
      return map;
    }, new Map<string, number>())
  );
  const dailyTradeMap = closedTrades.reduce((map, trade) => {
    const day = new Date(trade.closedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    map.set(day, (map.get(day) ?? 0) + trade.realizedPnl);
    return map;
  }, new Map<string, number>());
  const dailySummary = Array.from(dailyTradeMap.entries()).slice(-7);
  const dailyCalendarMap = closedTrades.reduce((map, trade) => {
    const date = new Date(trade.closedAt);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    map.set(key, (map.get(key) ?? 0) + trade.realizedPnl);
    return map;
  }, new Map<string, number>());
  const focusDate = closedTrades[0] ? new Date(closedTrades[0].closedAt) : new Date();
  const calendarCells = buildMonthGrid(dailyCalendarMap, focusDate);
  const profitFactor = averageLoss < 0 ? (closedTrades.filter((trade) => trade.realizedPnl > 0).reduce((sum, trade) => sum + trade.realizedPnl, 0) / Math.abs(closedTrades.filter((trade) => trade.realizedPnl <= 0).reduce((sum, trade) => sum + trade.realizedPnl, 0))) : null;
  const longProfit = closedTrades.filter((trade) => trade.side === "BUY").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const shortProfit = closedTrades.filter((trade) => trade.side === "SELL").reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const historyValues = snapshotHistory.length
    ? snapshotHistory.flatMap((item) => [item.balance, item.equity])
    : [Number(detailAccount?.currentBalance ?? 0), Number(detailAccount?.currentEquity ?? 0), Number(detailAccount?.startingBalance ?? 0)];
  const maxHistoryBalance = Math.max(...historyValues, Number(detailAccount?.currentBalance ?? 0));
  const minHistoryBalance = Math.min(...historyValues, Number(detailAccount?.startingBalance ?? 0));
  const historySeries = (snapshotHistory.length ? snapshotHistory : [{ balance: Number(detailAccount?.currentBalance ?? 0), equity: Number(detailAccount?.currentEquity ?? 0), id: "current" }]).map((point, index, array) => {
    const x = array.length === 1 ? 50 : 4 + ((index / (array.length - 1)) * 92);
    return {
      ...point,
      x,
      balanceY: toChartY(point.balance, minHistoryBalance, maxHistoryBalance),
      equityY: toChartY(point.equity, minHistoryBalance, maxHistoryBalance)
    };
  });
  const balancePath = historySeries.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.balanceY}`).join(" ");
  const equityPath = historySeries.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.equityY}`).join(" ");
  const balanceAreaPath = historySeries.length
    ? `M ${historySeries[0]?.x ?? 4} 88 ${historySeries.map((point) => `L ${point.x} ${point.balanceY}`).join(" ")} L ${historySeries[historySeries.length - 1]?.x ?? 96} 88 Z`
    : "";

  return (
    <SiteShell>
      <TopNav />
      <FlashToast items={toastItems} />
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            <a className="sidebar-link sidebar-link-gold" href="/checkout">New Challenge</a>
            <a className="sidebar-link" href="/dashboard/trades">Trade Now</a>
            <a className="sidebar-link" href="/dashboard">Overview</a>
            <a className="sidebar-link active" href="/dashboard/account">Account detail</a>
            <a className="sidebar-link" href="/dashboard/trades?tab=history">Trade history</a>
            <a className="sidebar-link" href="/dashboard/billing">Billing</a>
            <a className="sidebar-link" href="/dashboard/payouts">Payouts</a>
            <a className="sidebar-link" href="/dashboard/support">Support</a>
            <a className="sidebar-link" href="/login">Switch account</a>
            {session.role === "ADMIN" ? <a className="sidebar-link" href="/admin">Admin panel</a> : null}
          </nav>
          <form action={logoutAction}>
            <button className="ghost-button" type="submit">Log out</button>
          </form>
        </aside>

        <section className="dashboard-main account-page account-page-fixed">
          <section className="account-browser">
            <div className="account-browser-list">
              <div className="account-browser-header">
                <a href="/checkout" className="account-browser-buy">Buy Challenge</a>
              </div>

              <div className="account-browser-filters">
                <span className="account-browser-filter">All Types</span>
                <span className="account-browser-filter">All States</span>
                <span className="account-browser-filter">All Phases</span>
              </div>

              <div className="account-browser-cards">
                {accounts.map((account) => {
                  const stateTone = getStateTone(account.displayState);
                  const profitPct = (account.pnl / Number(account.startingBalance)) * 100;
                  const targetLabel = account.displayState === "FAILED" || account.displayState === "BREACHED"
                    ? "Failed by"
                    : account.displayState === "FUNDED"
                      ? "Next Reward"
                      : `Profit Target (${Math.round((Number(account.profitTarget) / Number(account.startingBalance)) * 100)}%)`;

                  return (
                    <a
                      key={account.id}
                      href={`/dashboard/account?accountId=${account.id}`}
                      className={`account-browser-card${selectedAccount?.id === account.id ? " active" : ""}`}
                    >
                      <div className="account-browser-card-head">
                        <div className="account-browser-card-title">
                          <span className="account-browser-card-icon" aria-hidden="true" />
                          <strong>#{account.login}</strong>
                        </div>
                        <div className="account-browser-card-actions">
                          <span className={`account-browser-state ${stateTone}`}>{account.displayState === "EVALUATION" ? "Ongoing" : account.displayState.replace("_", " ")}</span>
                          <span className="account-browser-more" aria-hidden="true">•••</span>
                        </div>
                      </div>
                      <p className="account-browser-meta">
                        {formatUsd(account.startingBalance).replace(".00", "")} <span>&bull;</span> {account.phaseCount > 1 ? "Two Step" : "One Step"} <span>&bull;</span> {getTierLabel(Number(account.startingBalance))}
                      </p>
                      <div className="account-browser-grid">
                        <div>
                          <span>Balance</span>
                          <strong>{formatUsd(account.currentBalance)}</strong>
                        </div>
                        <div>
                          <span>{targetLabel}</span>
                          <strong>
                            {account.displayState === "FAILED"
                              ? `${Math.abs(profitPct).toFixed(1)}%`
                              : account.displayState === "FUNDED"
                                ? "Not scheduled"
                                : `${Math.round(account.progressPct)}%`}
                          </strong>
                        </div>
                        <div>
                          <span>P&amp;L</span>
                          <strong className={account.pnl >= 0 ? "positive" : "negative"}>{account.pnl >= 0 ? "+" : ""}{formatUsd(account.pnl)}</strong>
                        </div>
                        <div>
                          <span>{account.displayState === "FAILED" ? "Failed by" : "Profit %"}</span>
                          <strong className={account.pnl >= 0 ? "positive" : "negative"}>
                            {account.displayState === "FAILED"
                              ? `${profitPct.toFixed(1)}%`
                              : `${account.pnl >= 0 ? "+" : ""}${profitPct.toFixed(1)}%`}
                          </strong>
                        </div>
                      </div>
                      <div className="account-browser-progress">
                        <span style={{ width: `${Math.max(0, Math.min(100, account.progressPct))}%` }} />
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="account-browser-detail">
              {detailAccount ? (
                  <div className="account-detail-panel">
                    <div className="account-detail-top">
                      <div>
                        <p className="eyebrow">Account detail</p>
                        <h2 className="page-title account-detail-title">#{detailAccount.login}</h2>
                        <p className="page-copy">Detailed account condition, phase metrics, and lifecycle checkpoints for the selected account.</p>
                      </div>
                      <div className="account-detail-top-actions">
                        <span className={`account-browser-state ${getStateTone(detailAccount.displayState)}`}>{detailAccount.displayState === "EVALUATION" ? "Ongoing" : detailAccount.displayState}</span>
                        {["PASSED", "FUNDED"].includes(detailAccount.displayState) ? (
                          <a className="ghost-button" href={`/dashboard/account/certificate?accountId=${detailAccount.id}`}>View certificate</a>
                        ) : null}
                      </div>
                    </div>

                  <div className="account-detail-metrics">
                    <article className="surface-card metric-panel">
                      <span className="muted-label">Platform login</span>
                      <strong className="metric-value">#{detailAccount.login}</strong>
                      <p className="surface-copy">{detailAccount.platform} | {detailAccount.connection}</p>
                    </article>
                    <article className="surface-card metric-panel">
                      <span className="muted-label">Trading password</span>
                      <strong className="metric-value"><code>{decryptTradingPassword(detailAccount.tradingPassword) ?? "Pending"}</code></strong>
                      <p className="surface-copy">Use this password with your Trade Now login.</p>
                    </article>
                    <article className="surface-card metric-panel">
                      <span className="muted-label">Credential status</span>
                      <strong className="metric-value">{detailAccount.credentialsIssuedAt ? "Issued" : "Pending"}</strong>
                      <p className="surface-copy">
                        {detailAccount.credentialsIssuedAt
                          ? `Credentials were issued ${new Date(detailAccount.credentialsIssuedAt).toLocaleString("en-GB")} and emailed to you. Use those details to sign in to Trade Now.`
                          : "Credentials will appear here once provisioning completes."}
                      </p>
                    </article>
                    <article className="surface-card metric-panel">
                      <span className="muted-label">Account size</span>
                      <strong className="metric-value">{formatUsd(detailAccount.startingBalance)}</strong>
                    </article>
                    <article className="surface-card metric-panel">
                      <span className="muted-label">Balance</span>
                      <strong className="metric-value">{formatUsd(detailAccount.currentBalance)}</strong>
                    </article>
                    <article className="surface-card metric-panel">
                      <span className="muted-label">Equity</span>
                      <strong className="metric-value">{formatUsd(detailAccount.currentEquity)}</strong>
                    </article>
                    <article className="surface-card metric-panel">
                      <span className="muted-label">Trading days</span>
                      <strong className="metric-value">{detailAccount.tradingDays}</strong>
                    </article>
                    <article className="surface-card metric-panel">
                      <span className="muted-label">PnL</span>
                      <strong className={`metric-value ${detailAccount.pnl >= 0 ? "positive" : "negative"}`}>{detailAccount.pnl >= 0 ? "+" : ""}{formatUsd(detailAccount.pnl)}</strong>
                    </article>
                  </div>

                  {provisioned ? (
      <section className="account-section">
        <article className="surface-card emphasis-card">
          <span className="muted-label">Account ready</span>
          <strong className="metric-value">Sign in to Trade Now</strong>
          <p className="surface-copy">Login: <code>#{detailAccount.login}</code></p>
          <p className="surface-copy">Password: <code>{decryptTradingPassword(detailAccount.tradingPassword) ?? "Pending"}</code></p>
          <div className="button-row">
                          <a href={selectedAccount ? `/dashboard/trades?accountId=${selectedAccount.id}` : "/dashboard/trades"} className="account-browser-buy">Open Trade Now</a>
                          <a href="/dashboard/billing" className="ghost-button">Open Billing</a>
                        </div>
                      </article>
                    </section>
                  ) : null}

                  <div className="account-detail-scroll">
                    <div className="account-detail-grid">
                      <article className="surface-card emphasis-card account-score-card">
                        <span className="muted-label">Score</span>
                        <strong className="metric-value">{(48 + clamp(detailAccount.progressPct / 2, 0, 52)).toFixed(2)}</strong>
                        <p className="surface-copy">Consistency / RR / WR / SL usage</p>
                      </article>

                      <article className="surface-card emphasis-card">
                        <span className="muted-label">Balance</span>
                        <strong className="metric-value">{formatUsd(detailAccount.currentBalance)}</strong>
                        <p className="surface-copy">Min {formatUsd(minHistoryBalance)} | Max {formatUsd(maxHistoryBalance)}</p>
                        <div className="progress-track"><span className="progress-fill" style={{ width: `${clamp(((Number(detailAccount.currentBalance) - minHistoryBalance) / Math.max(maxHistoryBalance - minHistoryBalance, 1)) * 100, 0, 100)}%` }} /></div>
                        <p className="surface-copy">Equity {formatUsd(detailAccount.currentEquity)}</p>
                      </article>
                    </div>

                    <section className="account-section">
                      <div className="detail-head">
                        <div>
                          <span className="muted-label">Account Balance</span>
                          <strong className="metric-value">Balance chart</strong>
                        </div>
                        <div className="account-chart-legend">
                          <span><i className="balance" />Balance</span>
                          <span><i className="equity" />Equity</span>
                        </div>
                      </div>
                      <article className="surface-card account-history-card">
                        <div className="account-history-head">
                          <strong>{formatUsd(detailAccount.currentBalance)}</strong>
                          <span className={Number(detailAccount.currentEquity) >= Number(detailAccount.currentBalance) ? "positive" : "negative"}>
                            Equity {formatUsd(detailAccount.currentEquity)}
                          </span>
                        </div>
                        <div className="account-line-chart">
                          <div className="account-axis top">{formatUsd(maxHistoryBalance)}</div>
                          <div className="account-axis bottom">{formatUsd(minHistoryBalance)}</div>
                          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            <path className="account-line-area" d={balanceAreaPath} />
                            <path className="account-line-path balance" d={balancePath} />
                            <path className="account-line-path equity" d={equityPath} />
                            {historySeries.map((point, index) => (
                              <g key={`${point.id}-${index}`}>
                                <circle className="account-line-dot balance" cx={point.x} cy={point.balanceY} r="1.8" />
                                <circle className="account-line-dot equity" cx={point.x} cy={point.equityY} r="1.8" />
                              </g>
                            ))}
                          </svg>
                        </div>
                        <div className="account-history-footer">
                          <span>Start {formatUsd(detailAccount.startingBalance)}</span>
                          <span>{historySeries.length} snapshots</span>
                          <span>Range {formatUsd(maxHistoryBalance - minHistoryBalance)}</span>
                        </div>
                      </article>
                    </section>

                    <section className="account-section">
                      <div className="detail-head">
                        <div>
                          <span className="muted-label">Trading objectives</span>
                          <strong className="metric-value">Rule progress</strong>
                        </div>
                      </div>
                      <div className="account-objective-list">
                        <article className="surface-card account-objective-card">
                          <div className="account-objective-head"><strong>Minimum Trading Days</strong><span>Progress: {formatPct((detailAccount.tradingDays / Math.max(detailAccount.snapshot.minTradingDays, 1)) * 100, 2)}</span></div>
                          <p>{detailAccount.tradingDays} of {detailAccount.snapshot.minTradingDays} trading days completed</p>
                          <div className="progress-track"><span className="progress-fill" style={{ width: `${clamp((detailAccount.tradingDays / Math.max(detailAccount.snapshot.minTradingDays, 1)) * 100, 0, 100)}%` }} /></div>
                        </article>
                        <article className="surface-card account-objective-card">
                          <div className="account-objective-head"><strong>Maximum Daily Loss</strong><span>Remaining: {formatUsd(detailAccount.snapshot.dailyLossRemaining)}</span></div>
                          <p>Maximum allowed daily loss: {formatUsd(detailAccount.dailyLossLimit)}</p>
                          <div className="progress-track"><span className="progress-fill" style={{ width: `${clamp((detailAccount.snapshot.dailyLossRemaining / Math.max(Number(detailAccount.dailyLossLimit), 1)) * 100, 0, 100)}%` }} /></div>
                        </article>
                        <article className="surface-card account-objective-card">
                          <div className="account-objective-head"><strong>Maximum Loss</strong><span>Remaining: {formatUsd(detailAccount.snapshot.totalLossRemaining)}</span></div>
                          <p>Maximum allowed loss: {formatUsd(detailAccount.totalLossLimit)}</p>
                          <div className="progress-track"><span className="progress-fill" style={{ width: `${clamp((detailAccount.snapshot.totalLossRemaining / Math.max(Number(detailAccount.totalLossLimit), 1)) * 100, 0, 100)}%` }} /></div>
                        </article>
                        <article className="surface-card account-objective-card">
                          <div className="account-objective-head"><strong>Profit Target</strong><span>{formatUsd(detailAccount.snapshot.currentProfit)} of {formatUsd(detailAccount.profitTarget)}</span></div>
                          <p>{detailAccount.displayState === "FAILED" ? "This account failed before reaching the objective." : "Track progress toward the active profit objective."}</p>
                          <div className="progress-track"><span className="progress-fill" style={{ width: `${clamp(detailAccount.progressPct, 0, 100)}%` }} /></div>
                        </article>
                      </div>
                    </section>

                    <section className="account-detail-metrics four-up">
                      <article className="surface-card metric-panel">
                        <span className="muted-label">Average win</span>
                        <strong className="metric-value positive">{formatUsd(averageWin)}</strong>
                      </article>
                      <article className="surface-card metric-panel">
                        <span className="muted-label">Win ratio</span>
                        <strong className="metric-value">{formatPct(winRatio)}</strong>
                      </article>
                      <article className="surface-card metric-panel">
                        <span className="muted-label">Average loss</span>
                        <strong className={`metric-value ${averageLoss < 0 ? "negative" : ""}`}>{formatUsd(averageLoss)}</strong>
                      </article>
                      <article className="surface-card metric-panel">
                        <span className="muted-label">Profit factor</span>
                        <strong className="metric-value">{profitFactor ? profitFactor.toFixed(2) : "--"}</strong>
                      </article>
                    </section>

                    <section className="account-detail-metrics three-up">
                      <article className="surface-card metric-panel">
                        <span className="muted-label">Number of days</span>
                        <strong className="metric-value">{detailAccount.tradingDays}</strong>
                      </article>
                      <article className="surface-card metric-panel">
                        <span className="muted-label">Total trades taken</span>
                        <strong className="metric-value">{closedTrades.length}</strong>
                      </article>
                      <article className="surface-card metric-panel">
                        <span className="muted-label">Total lots used</span>
                        <strong className="metric-value">{totalLots.toFixed(2)}</strong>
                      </article>
                      <article className="surface-card metric-panel">
                        <span className="muted-label">Biggest win</span>
                        <strong className="metric-value positive">{formatUsd(biggestWin)}</strong>
                      </article>
                      <article className="surface-card metric-panel">
                        <span className="muted-label">Biggest loss</span>
                        <strong className={`metric-value ${biggestLoss < 0 ? "negative" : ""}`}>{formatUsd(biggestLoss)}</strong>
                      </article>
                    </section>

                    <section className="account-detail-grid wide-gap">
                      <article className="surface-card emphasis-card">
                        <span className="muted-label">Short Analysis</span>
                        <strong className="metric-value">{formatUsd(shortProfit)}</strong>
                        <p className="surface-copy">Wins ({closedTrades.filter((trade) => trade.side === "SELL" && trade.realizedPnl > 0).length}) | Losses ({closedTrades.filter((trade) => trade.side === "SELL" && trade.realizedPnl <= 0).length})</p>
                        <div className="progress-track"><span className="progress-fill" style={{ width: `${clamp(winRatio, 0, 100)}%` }} /></div>
                      </article>
                      <article className="surface-card emphasis-card">
                        <span className="muted-label">Profitability</span>
                        <strong className="metric-value">{closedTrades.length}</strong>
                        <p className="surface-copy">Wins: {winCount} | Losses: {lossCount}</p>
                        <div className="progress-track"><span className="progress-fill" style={{ width: `${clamp(winRatio, 0, 100)}%` }} /></div>
                      </article>
                      <article className="surface-card emphasis-card">
                        <span className="muted-label">Long Analysis</span>
                        <strong className="metric-value">{formatUsd(longProfit)}</strong>
                        <p className="surface-copy">Wins ({closedTrades.filter((trade) => trade.side === "BUY" && trade.realizedPnl > 0).length}) | Losses ({closedTrades.filter((trade) => trade.side === "BUY" && trade.realizedPnl <= 0).length})</p>
                      </article>
                    </section>

                    <section className="account-detail-grid wide-gap">
                      <article className="surface-card emphasis-card">
                        <span className="muted-label">PnL Distribution by Duration</span>
                        <div className="account-bar-chart minimal">
                          {closedTrades.length ? closedTrades.map((trade) => {
                            const hours = Math.max(1, (new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime()) / 3600000);
                            return (
                              <div key={trade.ticket} className="account-bar-item">
                                <span className={`account-bar ${trade.realizedPnl >= 0 ? "positive" : "negative"}`} style={{ height: `${Math.max(8, Math.abs(trade.realizedPnl) / Math.max(...closedTrades.map((item) => Math.abs(item.realizedPnl)), 1) * 180)}px` }} />
                                <strong>{hours.toFixed(0)}h</strong>
                              </div>
                            );
                          }) : <p className="surface-copy">No duration distribution yet.</p>}
                        </div>
                      </article>
                      <article className="surface-card emphasis-card">
                        <span className="muted-label">PnL by Trade Duration</span>
                        <div className="account-line-chart compact">
                          {closedTrades.length ? closedTrades.map((trade, index) => {
                            const durationHours = Math.max(1, (new Date(trade.closedAt).getTime() - new Date(trade.openedAt).getTime()) / 3600000);
                            const x = closedTrades.length === 1 ? 0 : (index / (closedTrades.length - 1)) * 100;
                            const y = 100 - ((trade.realizedPnl - Math.min(...closedTrades.map((item) => item.realizedPnl))) / Math.max(Math.max(...closedTrades.map((item) => item.realizedPnl)) - Math.min(...closedTrades.map((item) => item.realizedPnl)), 1) * 100);
                            return <span key={trade.ticket} className={`account-scatter-dot ${trade.realizedPnl >= 0 ? "positive" : "negative"}`} style={{ left: `${x}%`, top: `${y}%` }} title={`${durationHours.toFixed(1)}h`} />;
                          }) : null}
                        </div>
                      </article>
                    </section>

                    <section className="account-detail-grid wide-gap">
                      <article className="surface-card emphasis-card">
                        <span className="muted-label">Instrument Profit Analysis</span>
                        <div className="account-bar-chart">
                          {instrumentProfit.length ? instrumentProfit.map(([symbol, pnl]) => (
                            <div key={symbol} className="account-bar-item">
                              <span className={`account-bar ${pnl >= 0 ? "positive" : "negative"}`} style={{ height: `${Math.max(8, Math.abs(pnl) / Math.max(...instrumentProfit.map(([, value]) => Math.abs(value)), 1) * 180)}px` }} />
                              <strong>{symbol}</strong>
                            </div>
                          )) : <p className="surface-copy">No closed trades yet.</p>}
                        </div>
                      </article>
                      <article className="surface-card emphasis-card">
                        <span className="muted-label">Instrument Volume Analysis</span>
                        <div className="account-bar-chart">
                          {instrumentLots.length ? instrumentLots.map(([symbol, lots]) => (
                            <div key={symbol} className="account-bar-item">
                              <span className="account-bar positive" style={{ height: `${Math.max(8, (lots / Math.max(...instrumentLots.map(([, value]) => value), 1)) * 180)}px` }} />
                              <strong>{symbol}</strong>
                            </div>
                          )) : <p className="surface-copy">No volume data yet.</p>}
                        </div>
                      </article>
                    </section>

                    <section className="account-section">
                      <div className="detail-head">
                        <div>
                          <span className="muted-label">Daily summary</span>
                          <strong className="metric-value">Recent trading days</strong>
                        </div>
                        <strong className="surface-copy">{formatMonthLabel(focusDate)}</strong>
                      </div>
                      <div className="account-calendar-wrap">
                        <div className="account-calendar-grid weekday">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
                        </div>
                        <div className="account-calendar-grid">
                          {calendarCells.map((cell, index) => (
                            <article key={`${cell.label}-${index}`} className={`account-calendar-cell${cell.active ? " active" : ""}${cell.pnl ? " has-pnl" : ""}`}>
                              <strong>{cell.label}</strong>
                              {cell.pnl !== null ? <span className={cell.pnl >= 0 ? "positive" : "negative"}>{formatUsd(cell.pnl)}</span> : null}
                            </article>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section className="account-section">
                      <div className="detail-head">
                        <div>
                          <span className="muted-label">Trading history</span>
                          <strong className="metric-value">Closed trades and open positions</strong>
                        </div>
                      </div>
                      <div className="account-detail-grid wide-gap">
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
                                {closedTrades.length ? closedTrades.map((trade) => (
                                  <tr key={trade.ticket}>
                                    <td>{trade.symbol}</td>
                                    <td>{trade.side}</td>
                                    <td>{trade.openPrice}</td>
                                    <td>{trade.closePrice}</td>
                                    <td>{formatUsd(trade.realizedPnl)}</td>
                                    <td>{new Date(trade.closedAt).toLocaleDateString("en-GB")}</td>
                                  </tr>
                                )) : (
                                  <tr><td colSpan={6}>No closed trades are available yet.</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </article>
                        <article className="surface-card emphasis-card">
                          <span className="muted-label">Open positions</span>
                          <div className="session-table">
                            {positions.length ? positions.map((position) => (
                              <div className="session-row" key={position.ticket}>
                                <span>{position.symbol}</span>
                                <strong>{formatUsd(position.unrealizedPnl)}</strong>
                                <span>{position.side} | {position.lots} lots</span>
                              </div>
                            )) : (
                              <div className="session-row">
                                <span>State</span>
                                <strong>No positions</strong>
                                <span>No live exposure in the current snapshot.</span>
                              </div>
                            )}
                          </div>
                        </article>
                      </div>
                    </section>

                    <article className="surface-card account-disclaimer">
                      <strong>Trading Results Disclaimer</strong>
                      <p className="surface-copy">Trading results on this dashboard are sourced from your internal Trade Now activity. Small timing differences can still appear while the workstation recalculates balances and history.</p>
                    </article>
                  </div>
                </div>
              ) : (
                <div className="account-detail-empty">
                  <div className="account-detail-empty-icon" aria-hidden="true">◫</div>
                  <h2>Select an Account to View Details</h2>
                  <p>Choose a trading account from the list to see its detailed information and performance metrics.</p>
                  <div className="account-detail-empty-cta">
                    <p>Don't have a new account yet?<br />Trade up to $2,000,000 in simulated capital.</p>
                    <a href="/checkout" className="account-browser-buy">Buy Challenge</a>
                  </div>
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
