import { syncAllTradingAccounts } from "../../web/lib/mt5/service";
import { getWorkerEnv } from "./env";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCycle() {
  const { syncLimit: limit } = getWorkerEnv();
  const { syncResults, lifecycleUpdates, payoutUpdates } = await syncAllTradingAccounts(limit ? { limit } : {});
  const succeeded = syncResults.filter((result) => result.status === "SUCCESS").length;
  const transitioned = lifecycleUpdates.filter((result) => result.transition !== "none").length;

  console.log(
    `[fundedpro-worker] synced ${syncResults.length} account(s), ${succeeded} successful, ${syncResults.length - succeeded} non-successful, ${transitioned} lifecycle transition(s), ${payoutUpdates.length} payout hold update(s)`
  );

  for (const result of syncResults) {
    console.log(`[fundedpro-worker] ${result.login} -> ${result.status}`);
  }
}

async function main() {
  const { pollMs } = getWorkerEnv();

  do {
    await runCycle();

    if (!pollMs || Number.isNaN(pollMs) || pollMs <= 0) {
      break;
    }

    await sleep(pollMs);
  } while (true);
}

main().catch((error) => {
  console.error("[fundedpro-worker] fatal error", error);
  process.exit(1);
});
