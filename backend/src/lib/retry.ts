/**
 * Retry Utility — Exponential backoff with configurable max retries.
 * Used by all agents for resilient external service calls.
 */
import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
};

/**
 * Execute a function with exponential backoff retry logic.
 *
 * @param fn - Async function to execute.
 * @param operationName - Name for logging purposes.
 * @param options - Retry configuration.
 * @returns Result of the function.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt > opts.maxRetries) {
        logger.error(
          { error: lastError, operation: operationName, attempt },
          `${operationName} failed after ${opts.maxRetries} retries`
        );
        break;
      }

      logger.warn(
        { error: lastError.message, operation: operationName, attempt, nextRetryMs: delay },
        `${operationName} failed (attempt ${attempt}/${opts.maxRetries + 1}), retrying in ${delay}ms`
      );

      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError ?? new Error(`${operationName} failed after retries`);
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
