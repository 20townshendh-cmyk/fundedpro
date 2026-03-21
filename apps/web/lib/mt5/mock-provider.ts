import type { PlatformAccountSnapshot, TradingPlatformProvider } from "./provider";

function numericSeed(input: string) {
  return input.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

type MockTradeSeed = {
  side: "BUY" | "SELL";
  pnl: number;
  openPrice: number;
  closePrice: number;
  openedHoursAgo: number;
  durationMinutes: number;
};

type MockScenario = {
  balance: number;
  equity: number;
  tradingDays: number;
  symbols: string[];
  positions: PlatformAccountSnapshot["positions"];
  closedTrades: MockTradeSeed[];
};

const ACCOUNT_SCENARIOS: Record<string, MockScenario> = {
  FP186457: {
    balance: 51285,
    equity: 51312,
    tradingDays: 4,
    symbols: ["NQ"],
    positions: [
      {
        ticket: "FP186457-P1",
        symbol: "NQ",
        side: "BUY",
        lots: 0.8,
        openPrice: 20834.2,
        markPrice: 20837.6,
        unrealizedPnl: 27
      }
    ],
    closedTrades: [
      { side: "BUY", pnl: 190, openPrice: 20708.1, closePrice: 20724.7, openedHoursAgo: 92, durationMinutes: 36 },
      { side: "SELL", pnl: -140, openPrice: 20866.8, closePrice: 20878.1, openedHoursAgo: 74, durationMinutes: 29 },
      { side: "BUY", pnl: 280, openPrice: 20752.4, closePrice: 20778.6, openedHoursAgo: 60, durationMinutes: 54 },
      { side: "SELL", pnl: 315, openPrice: 20821.2, closePrice: 20795.5, openedHoursAgo: 42, durationMinutes: 63 },
      { side: "BUY", pnl: 290, openPrice: 20712.8, closePrice: 20736.4, openedHoursAgo: 24, durationMinutes: 48 },
      { side: "SELL", pnl: 400, openPrice: 20844.6, closePrice: 20811.3, openedHoursAgo: 8, durationMinutes: 96 }
    ]
  },
  FP346459: {
    balance: 48000,
    equity: 47970,
    tradingDays: 3,
    symbols: ["NQ"],
    positions: [],
    closedTrades: [
      { side: "BUY", pnl: -420, openPrice: 20752.4, closePrice: 20718.2, openedHoursAgo: 84, durationMinutes: 41 },
      { side: "SELL", pnl: -510, openPrice: 20821.2, closePrice: 20858.5, openedHoursAgo: 61, durationMinutes: 52 },
      { side: "BUY", pnl: -470, openPrice: 20712.8, closePrice: 20678.4, openedHoursAgo: 39, durationMinutes: 58 },
      { side: "SELL", pnl: -600, openPrice: 20844.6, closePrice: 20888.3, openedHoursAgo: 18, durationMinutes: 77 }
    ]
  },
  FP272481: {
    balance: 47500,
    equity: 47468,
    tradingDays: 3,
    symbols: ["NQ"],
    positions: [],
    closedTrades: [
      { side: "BUY", pnl: -540, openPrice: 20712.8, closePrice: 20666.4, openedHoursAgo: 90, durationMinutes: 63 },
      { side: "SELL", pnl: -465, openPrice: 20811.2, closePrice: 20845.5, openedHoursAgo: 70, durationMinutes: 44 },
      { side: "BUY", pnl: -710, openPrice: 20698.1, closePrice: 20642.3, openedHoursAgo: 46, durationMinutes: 82 },
      { side: "SELL", pnl: -785, openPrice: 20832.4, closePrice: 20895.9, openedHoursAgo: 22, durationMinutes: 91 }
    ]
  },
  FP659490: {
    balance: 47650,
    equity: 47611,
    tradingDays: 2,
    symbols: ["NQ"],
    positions: [],
    closedTrades: [
      { side: "BUY", pnl: -350, openPrice: 20742.2, closePrice: 20714.5, openedHoursAgo: 76, durationMinutes: 35 },
      { side: "SELL", pnl: -690, openPrice: 20818.8, closePrice: 20869.4, openedHoursAgo: 55, durationMinutes: 48 },
      { side: "BUY", pnl: -610, openPrice: 20703.1, closePrice: 20655.8, openedHoursAgo: 33, durationMinutes: 66 },
      { side: "SELL", pnl: -700, openPrice: 20827.5, closePrice: 20882.2, openedHoursAgo: 11, durationMinutes: 87 }
    ]
  }
};

export class MockPlatformProvider implements TradingPlatformProvider {
  async getAccountSnapshot(login: string): Promise<PlatformAccountSnapshot> {
    const seed = numericSeed(login);
    const now = new Date();
    const scenario = ACCOUNT_SCENARIOS[login];
    const balance = scenario?.balance ?? 50000 + (seed % 2200);
    const equity = scenario?.equity ?? (balance - 180 + (seed % 260));
    const unrealizedPnl = Number((equity - balance).toFixed(2));
    const realizedPnl = Number((balance - 50000).toFixed(2));
    const totalLossUsed = Math.max(0, 50000 - equity);
    const dailyLossUsed = Math.max(0, balance - equity);
    const baseTrades = scenario?.closedTrades ?? [
      { side: "BUY" as const, pnl: 240, openPrice: 20718.4, closePrice: 20739.2, openedHoursAgo: 94, durationMinutes: 44 },
      { side: "SELL" as const, pnl: -120, openPrice: 20832.1, closePrice: 20841.3, openedHoursAgo: 80, durationMinutes: 37 },
      { side: "BUY" as const, pnl: 420, openPrice: 20752.4, closePrice: 20789.6, openedHoursAgo: 72, durationMinutes: 84 },
      { side: "SELL" as const, pnl: 315, openPrice: 20821.2, closePrice: 20796.5, openedHoursAgo: 52, durationMinutes: 63 },
      { side: "BUY" as const, pnl: -185, openPrice: 20712.8, closePrice: 20697.4, openedHoursAgo: 30, durationMinutes: 48 },
      { side: "SELL" as const, pnl: 508, openPrice: 20844.6, closePrice: 20802.3, openedHoursAgo: 12, durationMinutes: 96 }
    ];

    const closedTrades = baseTrades.map((trade, index) => {
      const openedAt = new Date(now.getTime() - trade.openedHoursAgo * 60 * 60 * 1000);
      const closedAt = new Date(openedAt.getTime() + trade.durationMinutes * 60 * 1000);

      return {
        ticket: `${login}-C${index + 1}`,
        symbol: "NQ",
        side: trade.side,
        lots: 0.8,
        openPrice: Number(trade.openPrice.toFixed(1)),
        closePrice: Number(trade.closePrice.toFixed(1)),
        realizedPnl: trade.pnl,
        openedAt: openedAt.toISOString(),
        closedAt: closedAt.toISOString()
      };
    });

    return {
      login,
      provider: "mock-mt5",
      balance,
      equity,
      realizedPnl,
      unrealizedPnl,
      drawdown: totalLossUsed,
      dailyLossUsed,
      totalLossUsed,
      tradingDays: scenario?.tradingDays ?? (4 + (seed % 3)),
      symbols: scenario?.symbols ?? ["NQ"],
      positions: scenario?.positions ?? [],
      closedTrades,
      rawPayload: {
        bridge: "mock",
        login,
        balance,
        equity,
        timestamps: {
          syncedAt: now.toISOString()
        },
        positions: 2,
        trades: closedTrades.length
      }
    };
  }
}

export const MockMt5Provider = MockPlatformProvider;
