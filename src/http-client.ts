import { HttpMethod, PingResult } from './types.js';
import { redactHeaders } from './utils/redact.js';

export interface ExecutePingOptions {
  serviceName: string;
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: string | null;
  timeoutMs: number;
  attempt?: number;
  expectedStatusCodes?: number[] | ((status: number) => boolean);
  externalSignal?: AbortSignal;
}

/**
 * Checks whether an HTTP status code is considered successful.
 */
export function isStatusSuccessful(
  status: number,
  expected?: number[] | ((status: number) => boolean),
): boolean {
  if (typeof expected === 'function') {
    return expected(status);
  }
  if (Array.isArray(expected) && expected.length > 0) {
    return expected.includes(status);
  }
  // Default: 2xx standard status range
  return status >= 200 && status < 300;
}

/**
 * Executes a single HTTP ping request with timeout and cancellation protection.
 */
export async function executePing(options: ExecutePingOptions): Promise<PingResult> {
  const {
    serviceName,
    url,
    method = 'GET',
    headers = {},
    body = null,
    timeoutMs,
    attempt = 1,
    expectedStatusCodes,
    externalSignal,
  } = options;

  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;
  let didTimeout = false;

  const onExternalAbort = () => {
    controller.abort(new Error('Operation cancelled'));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(new Error('Operation cancelled'));
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  // Set timeout abort timer
  timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const requestHeaders: Record<string, string> = {
    'User-Agent': 'service-keepalive/1.0.0',
    Accept: '*/*',
    ...headers,
  };

  const startTime = performance.now();
  const timestamp = new Date();

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal: controller.signal,
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    const durationMs = Math.round(performance.now() - startTime);

    const isOk = isStatusSuccessful(response.status, expectedStatusCodes);

    // Consume body stream to free sockets
    try {
      if (response.body) {
        // Read text or discard to avoid leaking sockets
        await response.text();
      }
    } catch {
      // Ignore drain errors
    }

    // Extract response headers (sanitized)
    const resHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    return {
      serviceName,
      url,
      method,
      status: response.status,
      statusText: response.statusText || `${response.status}`,
      ok: isOk,
      durationMs,
      attempt,
      timestamp,
      headers: redactHeaders(resHeaders),
      error: isOk ? undefined : `HTTP ${response.status} ${response.statusText || 'Error'}`,
    };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    let errorMessage = 'Unknown network error';

    if (didTimeout) {
      errorMessage = `Request timed out after ${timeoutMs}ms`;
    } else if (err instanceof Error) {
      if (err.name === 'AbortError' || err.message.includes('aborted')) {
        errorMessage = externalSignal?.aborted
          ? 'Request cancelled by user'
          : `Request timed out after ${timeoutMs}ms`;
      } else {
        errorMessage = err.message;
      }
    }

    return {
      serviceName,
      url,
      method,
      status: 0,
      statusText: 'Network Error',
      ok: false,
      durationMs,
      attempt,
      timestamp,
      error: errorMessage,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}
