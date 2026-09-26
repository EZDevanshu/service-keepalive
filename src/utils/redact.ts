const SENSITIVE_HEADER_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /token/i,
  /secret/i,
  /password/i,
  /api[_-]?key/i,
  /auth/i,
  /session/i,
  /credential/i,
  /private[_-]?key/i,
];

const SENSITIVE_QUERY_PARAMS = [
  'token',
  'key',
  'api_key',
  'apikey',
  'secret',
  'password',
  'passwd',
  'auth',
  'access_token',
  'bearer',
  'session',
];

/**
 * Returns a shallow copy of headers with sensitive values masked.
 */
export function redactHeaders(headers?: Record<string, string> | null): Record<string, string> {
  if (!headers) return {};

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const isSensitive = SENSITIVE_HEADER_PATTERNS.some(pattern => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Masks sensitive query parameters in a URL string for safe logging.
 */
export function redactUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    let modified = false;

    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.set(param, '[REDACTED]');
        modified = true;
      }
    }

    return modified ? url.toString() : urlStr;
  } catch {
    // If URL parsing fails, return as-is
    return urlStr;
  }
}
