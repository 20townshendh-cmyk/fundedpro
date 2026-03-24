import { getDb } from "@fundedpro/db";

let cachedProtectionColumnsAvailable: boolean | null = null;
let cachedAtMs = 0;

const CACHE_TTL_MS = 60_000;

export async function demoPositionProtectionColumnsAvailable() {
  if (cachedProtectionColumnsAvailable != null && Date.now() - cachedAtMs < CACHE_TTL_MS) {
    return cachedProtectionColumnsAvailable;
  }

  const db = getDb();
  const result = await db.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS "count"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'DemoPosition'
        AND column_name IN ('takeProfitPrice', 'stopLossPrice')
    `
  );

  cachedProtectionColumnsAvailable = Number(result.rows[0]?.count ?? "0") === 2;
  cachedAtMs = Date.now();

  return cachedProtectionColumnsAvailable;
}

