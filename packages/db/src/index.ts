import fs from "node:fs";
import { Pool } from "pg";
import path from "node:path";
export * from "@prisma/client";
export type Role = "TRADER" | "ADMIN";

declare global {
  // eslint-disable-next-line no-var
  var fundedProPool: Pool | undefined;
}

function createPool() {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../../../.env")
  ];

  for (const candidate of candidatePaths) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const file = fs.readFileSync(candidate, "utf8");
    const match = file.match(/^DATABASE_URL=(.+)$/m);

    if (match?.[1]) {
      process.env.DATABASE_URL = match[1].trim();
      break;
    }
  }

  const connectionString = process.env.DATABASE_URL?.replace("@localhost:", "@127.0.0.1:");

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const url = new URL(connectionString);
  const sslMode = (url.searchParams.get("sslmode") ?? process.env.PGSSLMODE ?? "").toLowerCase();
  const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  const useSsl =
    !isLocalHost &&
    sslMode !== "disable" &&
    sslMode !== "false" &&
    process.env.DATABASE_SSL !== "false";

  return new Pool({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });
}

export function getDb() {
  if (!globalThis.fundedProPool) {
    globalThis.fundedProPool = createPool();
  }

  return globalThis.fundedProPool;
}
