import { RetryStrategy } from './types.js';

export interface BackoffOptions {
  attempt: number;
  baseDelayMs: number;
  strategy?: RetryStrategy;
  maxDelayMs?: number;
  jitter?: boolean;
}

/**
 * Calculates the backoff delay in milliseconds for a given attempt.
 *
 * @param options Calculation parameters
 * @returns Delay in milliseconds
 */
export function calculateBackoff(options: BackoffOptions): number {
  const {
    attempt,
    baseDelayMs,
    strategy = 'exponential',
    maxDelayMs = 60000,
    jitter = true,
  } = options;

  if (attempt <= 0) return 0;

  let delay = baseDelayMs;

  switch (strategy) {
    case 'exponential':
      // 2^(attempt - 1) * baseDelay
      delay = baseDelayMs * Math.pow(2, attempt - 1);
      break;
    case 'linear':
      // attempt * baseDelay
      delay = baseDelayMs * attempt;
      break;
    case 'fixed':
    default:
      delay = baseDelayMs;
      break;
  }

  // Cap at maximum configured delay
  delay = Math.min(delay, maxDelayMs);

  // Apply ±20% randomized jitter if enabled to prevent thundering herd
  if (jitter) {
    const jitterFactor = 0.8 + Math.random() * 0.4; // between 0.8 and 1.2
    delay = Math.round(delay * jitterFactor);
  } else {
    delay = Math.round(delay);
  }

  return Math.max(0, delay);
}

/**
 * Asynchronously sleeps for the given duration, cancellable via AbortSignal.
 *
 * @param ms Duration in milliseconds
 * @param signal Optional AbortSignal to cancel waiting
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Operation aborted'));
    }

    let timer: NodeJS.Timeout | null = null;

    const onAbort = () => {
      if (timer) clearTimeout(timer);
      reject(new Error('Operation aborted'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);
  });
}
