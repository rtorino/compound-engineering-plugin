export interface RetryOptions {
  timeoutMs?: number;
}

export async function retry<T>(
  fn: () => T | Promise<T>,
  maxAttempts: number,
  options?: RetryOptions,
): Promise<T> {
  const { timeoutMs } = options ?? {};

  const execute = async (): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };

  if (timeoutMs && timeoutMs > 0) {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Retry timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([execute(), timeout]).finally(() => clearTimeout(timer));
  }

  return execute();
}
