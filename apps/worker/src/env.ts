type WorkerEnv = {
  pollMs: number;
  syncLimit: number | undefined;
};

let cachedEnv: WorkerEnv | null = null;

export function getWorkerEnv(): WorkerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const pollMs = process.env.WORKER_POLL_MS ? Number(process.env.WORKER_POLL_MS) : 0;
  const syncLimit = process.env.WORKER_SYNC_LIMIT ? Number(process.env.WORKER_SYNC_LIMIT) : undefined;

  if (Number.isNaN(pollMs) || pollMs < 0) {
    throw new Error("WORKER_POLL_MS must be a positive number or 0.");
  }

  if (syncLimit !== undefined && (Number.isNaN(syncLimit) || syncLimit <= 0)) {
    throw new Error("WORKER_SYNC_LIMIT must be a positive number when provided.");
  }

  cachedEnv = {
    pollMs,
    syncLimit
  };

  return cachedEnv;
}
