export type PlatformPosition = {
  ticket: string;
  symbol: string;
  side: "BUY" | "SELL";
  lots: number;
  openPrice: number;
  markPrice: number;
  unrealizedPnl: number;
};

export type PlatformClosedTrade = {
  ticket: string;
  symbol: string;
  side: "BUY" | "SELL";
  lots: number;
  openPrice: number;
  closePrice: number;
  realizedPnl: number;
  openedAt: string;
  closedAt: string;
};

export type PlatformAccountSnapshot = {
  login: string;
  provider: string;
  balance: number;
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  drawdown: number;
  dailyLossUsed: number;
  totalLossUsed: number;
  tradingDays: number;
  symbols: string[];
  positions: PlatformPosition[];
  closedTrades: PlatformClosedTrade[];
  rawPayload: Record<string, unknown>;
};

export interface TradingPlatformProvider {
  getAccountSnapshot(login: string): Promise<PlatformAccountSnapshot>;
}

export type Mt5Position = PlatformPosition;
export type Mt5ClosedTrade = PlatformClosedTrade;
export type Mt5AccountSnapshot = PlatformAccountSnapshot;
export type Mt5Provider = TradingPlatformProvider;
