/**
 * Multipliers in milliseconds for various duration units.
 */
const TIME_UNITS: Record<string, number> = {
  ms: 1,
  millisecond: 1,
  milliseconds: 1,
  s: 1000,
  sec: 1000,
  second: 1000,
  seconds: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  h: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
};

/**
 * Regex matching compound or single duration components (e.g. '10m', '30s', '1h30m', '500ms').
 */
const DURATION_REGEX = /^(\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*)+$/;
const DURATION_PART_REGEX = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g;

/**
 * Parses a human-readable duration string or millisecond number into milliseconds.
 *
 * Supported formats:
 * - Number: `5000` (treated as 5000ms)
 * - String: `'10s'`, `'30s'`, `'1m'`, `'5m'`, `'10m'`, `'1h'`, `'500ms'`, `'1m30s'`
 *
 * @throws {TypeError | RangeError} If the duration is invalid, zero, or negative.
 */
export function parseDuration(value: string | number, fieldName = 'Duration'): number {
  if (value === null || value === undefined) {
    throw new TypeError(`${fieldName} must be provided as a string or number.`);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new RangeError(`${fieldName} must be a finite number, received ${value}.`);
    }
    if (value <= 0) {
      throw new RangeError(`${fieldName} must be greater than 0, received ${value}.`);
    }
    return Math.round(value);
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string or number, received ${typeof value}.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new RangeError(`${fieldName} cannot be an empty string.`);
  }

  // If the string is purely digits, parse as milliseconds
  if (/^\d+$/.test(trimmed)) {
    const parsedNumber = Number(trimmed);
    if (parsedNumber <= 0) {
      throw new RangeError(`${fieldName} must be greater than 0.`);
    }
    return parsedNumber;
  }

  if (!DURATION_REGEX.test(trimmed)) {
    throw new RangeError(
      `Invalid ${fieldName} format: "${value}". Expected formats like "10s", "1m", "5m", "1h", "500ms".`,
    );
  }

  let totalMs = 0;
  let match: RegExpExecArray | null;
  DURATION_PART_REGEX.lastIndex = 0;

  while ((match = DURATION_PART_REGEX.exec(trimmed)) !== null) {
    const amountStr = match[1];
    const unitStr = match[2];

    if (!amountStr || !unitStr) {
      throw new RangeError(`Failed parsing ${fieldName} segment "${match[0]}".`);
    }

    const amount = parseFloat(amountStr);
    const unit = unitStr.toLowerCase();
    const multiplier = TIME_UNITS[unit];

    if (!multiplier) {
      throw new RangeError(
        `Unknown time unit "${unit}" in ${fieldName}. Supported units: ms, s, m, h, d.`,
      );
    }

    if (amount < 0 || !Number.isFinite(amount)) {
      throw new RangeError(`Invalid amount "${amount}" for unit "${unit}" in ${fieldName}.`);
    }

    totalMs += amount * multiplier;
  }

  const rounded = Math.round(totalMs);
  if (rounded <= 0) {
    throw new RangeError(`${fieldName} must evaluate to greater than 0ms.`);
  }

  return rounded;
}

/**
 * Formats a duration in milliseconds into a concise human-readable string.
 *
 * Examples:
 * - `142` -> `'142ms'`
 * - `5000` -> `'5s'`
 * - `60000` -> `'1m'`
 * - `90000` -> `'1m 30s'`
 * - `3600000` -> `'1h'`
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.length > 0 ? parts.join(' ') : `${ms}ms`;
}
