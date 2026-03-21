const SESSION_GATED_SYMBOLS = new Set(["ES", "NQ"]);

function getChicagoSessionParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);

  return {
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "Mon",
    minutes:
      (Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60) +
      Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  };
}

export function assertDemoInstrumentMarketOpen(symbol: string, now = new Date()) {
  if (!SESSION_GATED_SYMBOLS.has(symbol)) {
    return;
  }

  const { weekday, minutes } = getChicagoSessionParts(now);

  if (weekday === "Sat" || (weekday === "Fri" && minutes >= 16 * 60) || (weekday === "Sun" && minutes < 17 * 60)) {
    throw new Error("MARKET_CLOSED");
  }

  if (minutes >= 16 * 60 && minutes < 17 * 60) {
    throw new Error("MARKET_CLOSED");
  }
}
