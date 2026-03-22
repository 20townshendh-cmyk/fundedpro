import { redirect } from "next/navigation";
import { getDb } from "@fundedpro/db";
import { getChallengeSnapshot } from "@fundedpro/domain";
import { Footer, SiteShell, TopNav } from "@fundedpro/ui";
import { getSession, logoutAction } from "../../lib/auth";
import { getInternalTradingSnapshot, syncUserTradingAccountsFromDemo } from "../../lib/internal-trading-sync";

export const dynamic = "force-dynamic";

function formatUsd(value: string | number | undefined, options?: { compact?: boolean; signed?: boolean }) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: options?.compact ? "compact" : "standard",
    maximumFractionDigits: options?.compact ? 1 : 2,
    signDisplay: options?.signed ? "always" : "auto"
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function getFirstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || "Trader";
}

function getDisplayName(fullName: string, email: string) {
  const trimmed = fullName.trim();

  if (trimmed) {
    return trimmed;
  }

  return email.split("@")[0] || "Trader";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (!hours) {
    return `${mins}m`;
  }

  return `${hours}h ${mins}m`;
}

function getWeekdayPerformance(
  trades: Array<{ realizedPnl: number; closedAt: string }>
) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
  const totals = new Map<string, number>(labels.map((label) => [label, 0]));

  for (const trade of trades) {
    const label = new Date(trade.closedAt).toLocaleDateString("en-GB", {
      weekday: "short",
      timeZone: "UTC"
    });

    if (totals.has(label)) {
      totals.set(label, (totals.get(label) ?? 0) + trade.realizedPnl);
    }
  }

  const rows = labels.map((label) => ({
    label,
    amount: totals.get(label) ?? 0
  }));
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.amount)), 1);
  const bestDay = rows.reduce(
    (best, row) => (row.amount > best.amount ? row : best),
    rows[0] ?? { label: "Mon", amount: 0 }
  );

  return {
    rows: rows.map((row) => ({
      ...row,
      height: `${Math.max(18, (Math.abs(row.amount) / maxAbs) * 100)}%`,
      positive: row.amount >= 0
    })),
    bestDay: bestDay.label
  };
}

function getBehaviorBias(
  trades: Array<{ side: "BUY" | "SELL" }>
) {
  const bull = trades.filter((trade) => trade.side === "BUY").length;
  const bear = trades.filter((trade) => trade.side === "SELL").length;
  const total = bull + bear;
  const bullPct = total ? (bull / total) * 100 : 50;
  const bearPct = total ? (bear / total) * 100 : 50;

  return {
    bull,
    bear,
    bullPct,
    bearPct,
    title: bull === bear ? "Balanced Flow" : bull > bear ? "Rather Bull" : "Rather Bear"
  };
}

function getAverageHoldingMinutes(
  trades: Array<{ openedAt: string; closedAt: string }>
) {
  if (!trades.length) {
    return 0;
  }

  const totalMinutes = trades.reduce((sum, trade) => {
    const openedAt = new Date(trade.openedAt).getTime();
    const closedAt = new Date(trade.closedAt).getTime();
    return sum + Math.max(0, (closedAt - openedAt) / 60000);
  }, 0);

  return totalMinutes / trades.length;
}

function getInstrumentBreakdown(
  trades: Array<{ symbol: string; realizedPnl: number }>
) {
  const grouped = new Map<string, { symbol: string; wins: number; losses: number; total: number }>();

  for (const trade of trades) {
    const entry = grouped.get(trade.symbol) ?? {
      symbol: trade.symbol,
      wins: 0,
      losses: 0,
      total: 0
    };

    if (trade.realizedPnl >= 0) {
      entry.wins += 1;
    } else {
      entry.losses += 1;
    }

    entry.total += 1;
    grouped.set(trade.symbol, entry);
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.total - left.total)
    .slice(0, 3)
    .map((entry) => {
      const total = Math.max(entry.total, 1);
      return {
        ...entry,
        winWidth: `${(entry.wins / total) * 100}%`,
        lossWidth: `${(entry.losses / total) * 100}%`
      };
    });
}

function getSessionBreakdown(
  trades: Array<{ openedAt: string; realizedPnl: number }>
) {
  const sessions = [
    { label: "New York", start: 13, end: 21 },
    { label: "London", start: 7, end: 13 },
    { label: "Asia", start: 0, end: 7 }
  ];

  return sessions.map((session) => {
    const sessionTrades = trades.filter((trade) => {
      const hour = new Date(trade.openedAt).getUTCHours();
      return hour >= session.start && hour < session.end;
    });
    const wins = sessionTrades.filter((trade) => trade.realizedPnl >= 0).length;
    const rate = sessionTrades.length ? (wins / sessionTrades.length) * 100 : 0;

    return {
      label: session.label,
      rate,
      width: `${Math.max(12, rate)}%`
    };
  });
}

function getLevel(input: { totalRewardCents: number; accountState: string | undefined; progressPct: number }) {
  if (input.accountState === "FUNDED" || input.totalRewardCents >= 250000) {
    return "Gold";
  }

  if (input.progressPct >= 65 || input.totalRewardCents >= 50000) {
    return "Silver";
  }

  return "Bronze";
}

function getRadarPoints(values: { top: number; right: number; bottom: number; left: number }) {
  const centerX = 120;
  const centerY = 120;
  const radius = 82;
  const point = (angleDeg: number, value: number) => {
    const radians = (angleDeg * Math.PI) / 180;
    const scaled = radius * clamp(value / 100, 0.08, 1);
    return {
      x: centerX + Math.cos(radians) * scaled,
      y: centerY + Math.sin(radians) * scaled
    };
  };

  const top = point(-90, values.top);
  const right = point(0, values.right);
  const bottom = point(90, values.bottom);
  const left = point(180, values.left);

  return `${top.x},${top.y} ${right.x},${right.y} ${bottom.x},${bottom.y} ${left.x},${left.y}`;
}

function isLocalDbConnectionError(error: unknown) {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ECONNREFUSED") || message.includes("127.0.0.1:5433");
}

function renderOfflineDemoDashboard(session: Awaited<ReturnType<typeof getSession>>) {
  const displayName = session?.email === "admin@fundedpro.com" ? "Admin Demo" : "Trader Demo";
  const totalAllocation = 100000;
  const balance = 104380;
  const equity = 104125;
  const pnl = balance - totalAllocation;
  const totalTrades = 38;
  const winRate = 63.2;
  const lostTrades = 14;
  const wonTrades = totalTrades - lostTrades;
  const avgHolding = 94;
  const rewardCount = 2;
  const totalRewardCents = 185000;
  const highestRewardCents = 125000;
  const level = "Silver";
  const score = 78.4;
  const accountSummary = { totalAccounts: "1", latestLogin: "FP-20481" };
  const behavior = { title: "Rather Bull", bear: 15, bearPct: 39.5, bull: 23, bullPct: 60.5 };
  const weekdayPerformance = {
    bestDay: "Thu",
    rows: [
      { label: "Mon", amount: 420, height: "40%", positive: true },
      { label: "Tue", amount: -180, height: "24%", positive: false },
      { label: "Wed", amount: 690, height: "64%", positive: true },
      { label: "Thu", amount: 1040, height: "100%", positive: true },
      { label: "Fri", amount: 310, height: "33%", positive: true }
    ]
  };
  const instruments = [
    { symbol: "ES", wins: 10, losses: 4, winWidth: "71%", lossWidth: "29%" },
    { symbol: "NQ", wins: 8, losses: 6, winWidth: "57%", lossWidth: "43%" },
    { symbol: "CL", wins: 5, losses: 3, winWidth: "63%", lossWidth: "37%" }
  ];
  const sessions = [
    { label: "New York", rate: 68, width: "68%" },
    { label: "London", rate: 61, width: "61%" },
    { label: "Asia", rate: 42, width: "42%" }
  ];
  const radarValues = { top: 82, right: 73, bottom: winRate, left: 86 };
  const shareUrl = `mailto:?subject=${encodeURIComponent("FundedPro account summary")}&body=${encodeURIComponent(
    `Trader: ${displayName}\nAccount: ${accountSummary.latestLogin}\nAllocation: ${formatUsd(totalAllocation)}\nBalance: ${formatUsd(balance)}\nEquity: ${formatUsd(equity)}\nPnL: ${formatUsd(pnl, { signed: true })}`
  )}`;

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand">
            <p className="eyebrow">Trader workspace</p>
            <h2 className="sidebar-title">FundedPro</h2>
            <p className="surface-copy">Offline demo mode. Local database is unavailable, so this dashboard is showing seeded-style preview data.</p>
          </div>
          <nav className="sidebar-nav">
            <a className="sidebar-link sidebar-link-gold" href="/checkout">New Challenge</a>
            <a className="sidebar-link" href="/dashboard/trades">Trade Now</a>
            <a className="sidebar-link active" href="/dashboard">Overview</a>
            <a className="sidebar-link" href="/dashboard/account">Account detail</a>
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

        <section className="dashboard-main overview-page">
          <section className="overview-topbar">
            <div className="overview-greeting">
              <div className="overview-avatar">{displayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <h1 className="overview-hello">Hey, {displayName}</h1>
                <div className="overview-meta-row">
                  <span className="overview-brand-mark">FundedPro</span>
                  <span className="overview-divider" />
                  <strong>Trader Summary</strong>
                  <span className="overview-allocation">Total Allocation: {formatUsd(totalAllocation)}</span>
                </div>
              </div>
            </div>
            <div className="overview-actions">
              <a href="/checkout" className="overview-action overview-action-primary">New Challenge</a>
              <a href="/dashboard/trades" className="overview-action">Trade Now</a>
              <a href="/dashboard/account" className="overview-action">{accountSummary.totalAccounts} Logins</a>
              <a href={shareUrl} className="overview-action">Share</a>
            </div>
          </section>

          <section className="overview-grid">
            <article className="overview-card overview-card-score overview-score-card">
              <div className="overview-card-head">
                <strong>Score</strong>
              </div>
              <div className="overview-radar-wrap">
                <svg viewBox="0 0 240 240" className="overview-radar" aria-hidden="true">
                  {[20, 40, 60, 80, 100].map((ring) => {
                    const points = getRadarPoints({ top: ring, right: ring, bottom: ring, left: ring });
                    return <polygon key={ring} points={points} className="overview-radar-ring" />;
                  })}
                  <line x1="120" y1="20" x2="120" y2="220" className="overview-radar-axis" />
                  <line x1="20" y1="120" x2="220" y2="120" className="overview-radar-axis" />
                  <polygon points={getRadarPoints(radarValues)} className="overview-radar-shape" />
                  <circle cx="120" cy="120" r="4" className="overview-radar-center" />
                </svg>
                <span className="overview-radar-label overview-radar-label-top">Consistency</span>
                <span className="overview-radar-label overview-radar-label-right">SL usage</span>
                <span className="overview-radar-label overview-radar-label-bottom">WR</span>
                <span className="overview-radar-label overview-radar-label-left">RR</span>
              </div>
              <div className="overview-score-value">{score.toFixed(2)}</div>
            </article>

            <article className="overview-card overview-card-bias">
              <div className="overview-card-head">
                <strong>Behavioral Bias</strong>
                <span>Total Trades: {totalTrades}</span>
              </div>
              <div className="overview-bias-stage">
                <div className="overview-bias-token overview-bias-token-soft">Bear</div>
                <strong className="overview-bias-title">{behavior.title}</strong>
                <div className="overview-bias-token overview-bias-token-glow">Bull</div>
              </div>
              <div className="overview-bias-track">
                <span className="overview-bias-fill" style={{ width: `${behavior.bullPct}%` }} />
              </div>
              <div className="overview-bias-meta">
                <strong>{behavior.bear} ({formatPercent(behavior.bearPct)})</strong>
                <strong>{behavior.bull} ({formatPercent(behavior.bullPct)})</strong>
              </div>
            </article>

            <article className="overview-card overview-card-day">
              <div className="overview-card-head">
                <strong>Trading Day Performance</strong>
                <span>Best Day: {weekdayPerformance.bestDay}</span>
              </div>
              <div className="overview-weekday-chart">
                {weekdayPerformance.rows.map((row) => (
                  <div className="overview-weekday-col" key={row.label}>
                    <div className={`overview-weekday-bar ${row.positive ? "positive" : "negative"}`} style={{ height: row.height }} />
                    <strong>{formatUsd(row.amount, { signed: row.amount !== 0, compact: true })}</strong>
                    <span>{row.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="overview-card overview-card-level overview-level-card">
              <div className="overview-level-copy">
                <span>Your Level</span>
                <strong>{level}</strong>
                <div className="overview-level-stats">
                  <div>
                    <span>Total Reward</span>
                    <strong>{formatUsd(totalRewardCents / 100)}</strong>
                  </div>
                  <div>
                    <span>Highest Reward</span>
                    <strong>{formatUsd(highestRewardCents / 100)}</strong>
                  </div>
                  <div>
                    <span>Count</span>
                    <strong>{rewardCount}</strong>
                  </div>
                </div>
                <p className="surface-copy">Latest trading login: #{accountSummary.latestLogin}</p>
              </div>
              <div className="overview-level-badge">FP</div>
            </article>

            <article className="overview-card overview-card-profit overview-profit-card">
              <div className="overview-card-head">
                <strong>Profitability</strong>
                <span>Avg Holding Period: {formatDuration(avgHolding)}</span>
              </div>
              <div className="overview-profit-layout">
                <div className="overview-profit-side">
                  <span>Won</span>
                  <strong>{formatPercent(winRate)}</strong>
                  <small>{wonTrades}</small>
                </div>
                <div
                  className="overview-profit-gauge"
                  style={{
                    background: `conic-gradient(from 180deg, #ff616b 0deg ${(100 - winRate) * 1.8}deg, #12c48b ${(100 - winRate) * 1.8}deg 180deg, transparent 180deg 360deg)`
                  }}
                >
                  <div className="overview-profit-gauge-inner">
                    <span>Trades Taken</span>
                    <strong>{totalTrades}</strong>
                    <small>Winrate: {formatPercent(winRate)}</small>
                  </div>
                </div>
                <div className="overview-profit-side align-end">
                  <span>Lost</span>
                  <strong>{formatPercent(100 - winRate)}</strong>
                  <small>{lostTrades}</small>
                </div>
              </div>
            </article>

            <article className="overview-card overview-card-instruments">
              <div className="overview-card-head">
                <strong>Most Traded Instruments</strong>
              </div>
              <div className="overview-stacked-list">
                {instruments.map((item) => (
                  <div className="overview-stacked-row" key={item.symbol}>
                    <div className="overview-stacked-head">
                      <strong>{item.symbol}</strong>
                      <span>{item.wins}W / {item.losses}L</span>
                    </div>
                    <div className="overview-stacked-track">
                      <span className="overview-stacked-win" style={{ width: item.winWidth }} />
                      <span className="overview-stacked-loss" style={{ width: item.lossWidth }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="overview-card overview-card-sessions">
              <div className="overview-card-head">
                <strong>Session Win Rates</strong>
              </div>
              <div className="overview-session-list">
                {sessions.map((sessionRow) => (
                  <div className="overview-session-row" key={sessionRow.label}>
                    <div className="overview-session-head">
                      <strong>{sessionRow.label}</strong>
                      <span>{formatPercent(sessionRow.rate)}</span>
                    </div>
                    <div className="overview-session-track">
                      <span className="overview-session-fill" style={{ width: sessionRow.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const db = getDb();
  let userResult;
  let accountResult;
  let orderResult;
  let payoutResult;
  let accountSummaryResult;
  let internalSnapshot;

  try {
    await syncUserTradingAccountsFromDemo(session.userId);

    [userResult, accountResult, orderResult, payoutResult, accountSummaryResult] = await Promise.all([
      db.query<{ id: string; fullName: string }>('SELECT "id", "fullName" FROM "User" WHERE "id" = $1 LIMIT 1', [
        session.userId
      ]),
      db.query<{
        id: string;
        login: string;
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
      }>(
        `
          SELECT "id", "login", "accountState", "currentPhase", "provider", "startingBalance", "phaseStartBalance", "currentBalance", "currentEquity", "tradingDays", "profitTarget", "dailyLossLimit", "totalLossLimit"
          FROM "TradingAccount"
          WHERE "userId" = $1
          ORDER BY "createdAt" DESC
          LIMIT 1
        `,
        [session.userId]
      ),
      db.query<{ name: string; accountSize: number; minTradingDays: number; phaseCount: number }>(
        `
          SELECT cp."name", cp."accountSize", cp."minTradingDays", cp."phaseCount"
          FROM "ChallengeOrder" co
          JOIN "ChallengePlan" cp ON cp."id" = co."challengePlanId"
          WHERE co."userId" = $1
          ORDER BY co."createdAt" DESC
          LIMIT 1
        `,
        [session.userId]
      ),
      db.query<{ totalRewardCents: string; highestRewardCents: string; rewardCount: string }>(
        `
          SELECT
            COALESCE(SUM(CASE WHEN "status" = 'PAID' THEN "amountCents" ELSE 0 END), 0)::text AS "totalRewardCents",
            COALESCE(MAX(CASE WHEN "status" = 'PAID' THEN "amountCents" ELSE 0 END), 0)::text AS "highestRewardCents",
            COUNT(*) FILTER (WHERE "status" = 'PAID')::text AS "rewardCount"
          FROM "PayoutRequest"
          WHERE "userId" = $1
        `,
        [session.userId]
      ),
      db.query<{ totalAccounts: string; latestLogin: string | null }>(
        `
          SELECT
            COUNT(*)::text AS "totalAccounts",
            (
              SELECT ta."login"
              FROM "TradingAccount" ta
              WHERE ta."userId" = $1
              ORDER BY ta."createdAt" DESC
              LIMIT 1
            ) AS "latestLogin"
          FROM "TradingAccount"
          WHERE "userId" = $1
        `,
        [session.userId]
      )
    ]);

    const activeAccount = accountResult.rows[0];
    internalSnapshot = activeAccount ? await getInternalTradingSnapshot(activeAccount.id) : null;
  } catch (error) {
    if (isLocalDbConnectionError(error)) {
      return renderOfflineDemoDashboard(session);
    }

    throw error;
  }

  const user = userResult.rows[0];
  const activeAccount = accountResult.rows[0];
  const latestOrder = orderResult.rows[0];
  const payoutSummary = payoutResult.rows[0];
  const accountSummary = accountSummaryResult.rows[0] ?? { totalAccounts: "0", latestLogin: null };

  if (!user) {
    redirect("/login");
  }

  if (!activeAccount || !latestOrder) {
    return renderOfflineDemoDashboard(session);
  }

  const displayName = getDisplayName(user.fullName, session.email);
  const trades = internalSnapshot?.closedTrades ?? [];
  const balance = Number(activeAccount?.currentBalance ?? 0);
  const equity = Number(activeAccount?.currentEquity ?? 0);
  const totalAllocation = latestOrder?.accountSize ?? Number(activeAccount?.startingBalance ?? 0);
  const totalRewardCents = Number(payoutSummary?.totalRewardCents ?? 0);
  const highestRewardCents = Number(payoutSummary?.highestRewardCents ?? 0);
  const rewardCount = Number(payoutSummary?.rewardCount ?? 0);
  const snapshot = getChallengeSnapshot({
    startingBalance: Number(activeAccount?.startingBalance ?? totalAllocation),
    phaseStartBalance: Number(activeAccount?.phaseStartBalance ?? activeAccount?.startingBalance ?? totalAllocation),
    currentBalance: balance,
    currentEquity: equity,
    profitTarget: Number(activeAccount?.profitTarget ?? 0),
    dailyLossLimit: Number(activeAccount?.dailyLossLimit ?? 0),
    totalLossLimit: Number(activeAccount?.totalLossLimit ?? 0),
    tradingDays: activeAccount?.tradingDays ?? 0,
    minTradingDays: latestOrder?.minTradingDays ?? 3,
    accountState: activeAccount?.accountState,
    currentPhase: activeAccount?.currentPhase ?? 1,
    phaseCount: latestOrder?.phaseCount ?? 1
  });

  const pnl = snapshot.currentProfit;
  const progressPct = clamp(snapshot.targetProgressPct, 0, 100);
  const totalTrades = trades.length;
  const wonTrades = trades.filter((trade) => trade.realizedPnl >= 0).length;
  const lostTrades = Math.max(0, totalTrades - wonTrades);
  const winRate = totalTrades ? (wonTrades / totalTrades) * 100 : 0;
  const avgHolding = getAverageHoldingMinutes(trades);
  const weekdayPerformance = getWeekdayPerformance(trades);
  const behavior = getBehaviorBias(trades);
  const instruments = getInstrumentBreakdown(trades);
  const sessions = getSessionBreakdown(trades);
  const level = getLevel({
    totalRewardCents,
    accountState: activeAccount?.accountState,
    progressPct
  });
  const totalLossLimit = Number(activeAccount?.totalLossLimit ?? 0);
  const totalLossUsed = Number(internalSnapshot?.totalLossUsed ?? 0);
  const radarValues = {
    top: clamp(58 + progressPct * 0.25, 20, 100),
    right: clamp(totalLossLimit ? 100 - (totalLossUsed / totalLossLimit) * 100 : 100, 10, 100),
    bottom: clamp(winRate, 8, 100),
    left: snapshot.ruleStatus === "stable" ? 92 : snapshot.ruleStatus === "warning" ? 64 : 28
  };
  const score = (radarValues.top + radarValues.right + radarValues.bottom + radarValues.left) / 4;
  const shareUrl = `mailto:?subject=${encodeURIComponent("FundedPro account summary")}&body=${encodeURIComponent(
    `Trader: ${user.fullName}\nAccount: ${activeAccount?.login ?? "Pending"}\nAllocation: ${formatUsd(totalAllocation)}\nBalance: ${formatUsd(balance)}\nEquity: ${formatUsd(equity)}\nPnL: ${formatUsd(pnl, { signed: true })}`
  )}`;

  return (
    <SiteShell>
      <TopNav />
      <main className="dashboard-shell">
        <aside className="dashboard-sidebar">
          <div className="sidebar-brand">
            <p className="eyebrow">Trader workspace</p>
            <h2 className="sidebar-title">FundedPro</h2>
            <p className="surface-copy">Premium visibility across challenge status, balances, drawdown limits, and progression.</p>
          </div>
          <nav className="sidebar-nav">
            <a className="sidebar-link sidebar-link-gold" href="/checkout">New Challenge</a>
            <a className="sidebar-link" href="/dashboard/trades">Trade Now</a>
            <a className="sidebar-link active" href="/dashboard">Overview</a>
            <a className="sidebar-link" href="/dashboard/account">Account detail</a>
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

        <section className="dashboard-main overview-page">
          <section className="overview-topbar">
            <div className="overview-greeting">
              <div className="overview-avatar">{displayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <h1 className="overview-hello">Hey, {displayName}</h1>
                <div className="overview-meta-row">
                  <span className="overview-brand-mark">FundedPro</span>
                  <span className="overview-divider" />
                  <strong>Trader Summary</strong>
                  <span className="overview-allocation">Total Allocation: {formatUsd(totalAllocation)}</span>
                </div>
              </div>
            </div>
            <div className="overview-actions">
              <a href="/checkout" className="overview-action overview-action-primary">New Challenge</a>
              <a href="/dashboard/trades" className="overview-action">Trade Now</a>
              <a href="/dashboard/account" className="overview-action">{accountSummary.totalAccounts} Logins</a>
              <a href={shareUrl} className="overview-action">Share</a>
            </div>
          </section>

          <section className="overview-grid">
            <article className="overview-card overview-card-score overview-score-card">
              <div className="overview-card-head">
                <strong>Score</strong>
              </div>
              <div className="overview-radar-wrap">
                <svg viewBox="0 0 240 240" className="overview-radar" aria-hidden="true">
                  {[20, 40, 60, 80, 100].map((ring) => {
                    const points = getRadarPoints({ top: ring, right: ring, bottom: ring, left: ring });
                    return <polygon key={ring} points={points} className="overview-radar-ring" />;
                  })}
                  <line x1="120" y1="20" x2="120" y2="220" className="overview-radar-axis" />
                  <line x1="20" y1="120" x2="220" y2="120" className="overview-radar-axis" />
                  <polygon points={getRadarPoints(radarValues)} className="overview-radar-shape" />
                  <circle cx="120" cy="120" r="4" className="overview-radar-center" />
                </svg>
                <span className="overview-radar-label overview-radar-label-top">Consistency</span>
                <span className="overview-radar-label overview-radar-label-right">SL usage</span>
                <span className="overview-radar-label overview-radar-label-bottom">WR</span>
                <span className="overview-radar-label overview-radar-label-left">RR</span>
              </div>
              <div className="overview-score-value">{score.toFixed(2)}</div>
            </article>

            <article className="overview-card overview-card-bias">
              <div className="overview-card-head">
                <strong>Behavioral Bias</strong>
                <span>Total Trades: {totalTrades}</span>
              </div>
              <div className="overview-bias-stage">
                <div className="overview-bias-token overview-bias-token-soft">Bear</div>
                <strong className="overview-bias-title">{behavior.title}</strong>
                <div className="overview-bias-token overview-bias-token-glow">Bull</div>
              </div>
              <div className="overview-bias-track">
                <span className="overview-bias-fill" style={{ width: `${behavior.bullPct}%` }} />
              </div>
              <div className="overview-bias-meta">
                <strong>{behavior.bear} ({formatPercent(behavior.bearPct)})</strong>
                <strong>{behavior.bull} ({formatPercent(behavior.bullPct)})</strong>
              </div>
            </article>

            <article className="overview-card overview-card-day">
              <div className="overview-card-head">
                <strong>Trading Day Performance</strong>
                <span>Best Day: {weekdayPerformance.bestDay}</span>
              </div>
              <div className="overview-weekday-chart">
                {weekdayPerformance.rows.map((row) => (
                  <div className="overview-weekday-col" key={row.label}>
                    <div className={`overview-weekday-bar ${row.positive ? "positive" : "negative"}`} style={{ height: row.height }} />
                    <strong>{formatUsd(row.amount, { signed: row.amount !== 0, compact: true })}</strong>
                    <span>{row.label}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="overview-card overview-card-level overview-level-card">
              <div className="overview-level-copy">
                <span>Your Level</span>
                <strong>{level}</strong>
                <div className="overview-level-stats">
                  <div>
                    <span>Total Reward</span>
                    <strong>{formatUsd(totalRewardCents / 100)}</strong>
                  </div>
                  <div>
                    <span>Highest Reward</span>
                    <strong>{formatUsd(highestRewardCents / 100)}</strong>
                  </div>
                  <div>
                    <span>Count</span>
                    <strong>{rewardCount}</strong>
                  </div>
                </div>
                <p className="surface-copy">Latest trading login: {accountSummary.latestLogin ? `#${accountSummary.latestLogin}` : "Pending provisioning"}</p>
              </div>
              <div className="overview-level-badge">FP</div>
            </article>

            <article className="overview-card overview-card-profit overview-profit-card">
              <div className="overview-card-head">
                <strong>Profitability</strong>
                <span>Avg Holding Period: {formatDuration(avgHolding)}</span>
              </div>
              <div className="overview-profit-layout">
                <div className="overview-profit-side">
                  <span>Won</span>
                  <strong>{formatPercent(winRate)}</strong>
                  <small>{wonTrades}</small>
                </div>
                <div
                  className="overview-profit-gauge"
                  style={{
                    background: `conic-gradient(from 180deg, #ff616b 0deg ${(100 - winRate) * 1.8}deg, #12c48b ${(100 - winRate) * 1.8}deg 180deg, transparent 180deg 360deg)`
                  }}
                >
                  <div className="overview-profit-gauge-inner">
                    <span>Trades Taken</span>
                    <strong>{totalTrades}</strong>
                    <small>Winrate: {formatPercent(winRate)}</small>
                  </div>
                </div>
                <div className="overview-profit-side align-end">
                  <span>Lost</span>
                  <strong>{formatPercent(100 - winRate)}</strong>
                  <small>{lostTrades}</small>
                </div>
              </div>
            </article>

            <article className="overview-card overview-card-instruments">
              <div className="overview-card-head">
                <strong>Most Traded Instruments</strong>
              </div>
              <div className="overview-stacked-list">
                {(instruments.length ? instruments : [{ symbol: "No trades yet", wins: 0, losses: 0, winWidth: "0%", lossWidth: "0%" }]).map((item) => (
                  <div className="overview-stacked-row" key={item.symbol}>
                    <div className="overview-stacked-head">
                      <strong>{item.symbol}</strong>
                      {"wins" in item ? <span>{item.wins}W / {item.losses}L</span> : null}
                    </div>
                    <div className="overview-stacked-track">
                      <span className="overview-stacked-win" style={{ width: item.winWidth }} />
                      <span className="overview-stacked-loss" style={{ width: item.lossWidth }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="overview-card overview-card-sessions">
              <div className="overview-card-head">
                <strong>Session Win Rates</strong>
              </div>
              <div className="overview-session-list">
                {sessions.map((sessionRow) => (
                  <div className="overview-session-row" key={sessionRow.label}>
                    <div className="overview-session-head">
                      <strong>{sessionRow.label}</strong>
                      <span>{formatPercent(sessionRow.rate)}</span>
                    </div>
                    <div className="overview-session-track">
                      <span className="overview-session-fill" style={{ width: sessionRow.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </section>
      </main>
      <Footer />
    </SiteShell>
  );
}
