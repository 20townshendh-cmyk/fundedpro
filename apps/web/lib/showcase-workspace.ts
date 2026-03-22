export const showcaseWorkspace = {
  accountId: "showcase-account",
  login: "FP-20481",
  displayName: "Trader Demo",
  accountSize: 100000,
  balance: 104380,
  equity: 104125,
  pnl: 4380,
  progressPct: 48,
  phaseCount: 1,
  level: "Silver",
  totalTrades: 38,
  wonTrades: 24,
  lostTrades: 14,
  winRate: 63.2,
  avgHoldingMinutes: 94,
  totalRewardCents: 185000,
  highestRewardCents: 125000,
  rewardCount: 2,
  score: 78.4,
  behavior: { title: "Rather Bull", bear: 15, bearPct: 39.5, bull: 23, bullPct: 60.5 },
  weekdayPerformance: {
    bestDay: "Thu",
    rows: [
      { label: "Mon", amount: 420, height: "40%", positive: true },
      { label: "Tue", amount: -180, height: "24%", positive: false },
      { label: "Wed", amount: 690, height: "64%", positive: true },
      { label: "Thu", amount: 1040, height: "100%", positive: true },
      { label: "Fri", amount: 310, height: "33%", positive: true }
    ]
  },
  instruments: [
    { symbol: "ES", wins: 10, losses: 4, winWidth: "71%", lossWidth: "29%" },
    { symbol: "NQ", wins: 8, losses: 6, winWidth: "57%", lossWidth: "43%" },
    { symbol: "CL", wins: 5, losses: 3, winWidth: "63%", lossWidth: "37%" }
  ],
  sessions: [
    { label: "New York", rate: 68, width: "68%" },
    { label: "London", rate: 61, width: "61%" },
    { label: "Asia", rate: 42, width: "42%" }
  ],
  radarValues: { top: 82, right: 73, bottom: 63.2, left: 86 },
  closedTrades: [
    { symbol: "ES", side: "BUY", openPrice: "5214.25", closePrice: "5220.75", realized: "+$420.00", closed: "21/03/2026" },
    { symbol: "NQ", side: "SELL", openPrice: "18206.00", closePrice: "18192.25", realized: "+$690.00", closed: "20/03/2026" },
    { symbol: "CL", side: "BUY", openPrice: "77.18", closePrice: "76.92", realized: "-$180.00", closed: "19/03/2026" }
  ],
  positions: [
    { symbol: "ES", pnl: "+$125.00", detail: "BUY | 2 lots" },
    { symbol: "NQ", pnl: "-$42.00", detail: "SELL | 1 lot" }
  ],
  invoices: [
    { reference: "INV-20481", status: "PAID", amount: "$210", date: "21/03/2026" },
    { reference: "INV-19874", status: "PAID", amount: "$140", date: "12/03/2026" }
  ],
  payouts: [
    { reference: "RW-0001", type: "Reward", requestedOn: "18/03/2026", method: "Manual", status: "APPROVED", amount: "$1,250", certificate: "View", invoice: "Available" }
  ]
} as const;
