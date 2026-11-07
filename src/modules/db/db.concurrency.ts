class FifoWriteMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  get depth(): number {
    return this.queue.length + (this.locked ? 1 : 0);
  }

  async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return this.createRelease();
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        resolve(this.createRelease());
      });
    });
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.queue.shift();
      if (next) {
        next();
      } else {
        this.locked = false;
      }
    };
  }
}

const globalForMutex = globalThis as unknown as {
  __sezsecWriteMutex?: FifoWriteMutex;
};

const writeMutex = globalForMutex.__sezsecWriteMutex ?? new FifoWriteMutex();
if (process.env.NODE_ENV !== "production") {
  globalForMutex.__sezsecWriteMutex = writeMutex;
}

export function getWriteQueueDepth(): number {
  return writeMutex.depth;
}

function isTransientSqliteLockError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  const msg = (err.message || "").toUpperCase();
  const code = (err.code || "").toUpperCase();
  return (
    code === "SQLITE_BUSY" ||
    code === "SQLITE_LOCKED" ||
    code === "P2034" ||
    code === "P1008" ||
    msg.includes("SQLITE_BUSY") ||
    msg.includes("DATABASE IS LOCKED")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Serializes SQLite write operations in strict FIFO order within the Node process
 * and automatically retries transient cross-process SQLITE_BUSY locks with jitter.
 */
export async function withWriteLock<T>(
  operation: () => Promise<T>,
  maxRetries = 5
): Promise<T> {
  const release = await writeMutex.acquire();
  try {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt += 1;
        if (attempt > maxRetries || !isTransientSqliteLockError(error)) {
          throw error;
        }
        const backoffMs = Math.min(800, 35 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 25);
        await sleep(backoffMs);
      }
    }
  } finally {
    release();
  }
}
