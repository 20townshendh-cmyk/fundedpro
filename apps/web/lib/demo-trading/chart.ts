type TickPoint = {
  price: string;
  createdAt: Date;
};

export type DemoCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function buildCandlesFromTicks(ticks: TickPoint[], intervalSeconds = 300): DemoCandle[] {
  const ordered = ticks
    .map((tick) => ({ price: Number(tick.price), createdAt: new Date(tick.createdAt) }))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  const candles: DemoCandle[] = [];
  const candleMap = new Map<number, DemoCandle>();

  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index]!;
    const previous = ordered[index - 1];
    const bucketTime = Math.floor(entry.createdAt.getTime() / 1000 / intervalSeconds) * intervalSeconds;
    const volumeStep = index === 0 || !previous ? 12 : Math.max(4, Math.abs(entry.price - previous.price) * 18);
    const existing = candleMap.get(bucketTime);

    if (!existing) {
      candleMap.set(bucketTime, {
        time: bucketTime,
        open: entry.price,
        high: entry.price,
        low: entry.price,
        close: entry.price,
        volume: Math.max(1, Math.round(volumeStep))
      });
      continue;
    }

    existing.high = Math.max(existing.high, entry.price);
    existing.low = Math.min(existing.low, entry.price);
    existing.close = entry.price;
    existing.volume += Math.max(1, Math.round(volumeStep));
  }

  candleMap.forEach((candle) => {
    candles.push(candle);
  });

  return candles.sort((left, right) => left.time - right.time);
}
