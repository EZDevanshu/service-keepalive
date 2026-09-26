import { describe, it, expect } from 'vitest';
import { parseDuration, formatDuration } from '../src/utils/duration.js';

describe('parseDuration', () => {
  it('should parse numeric milliseconds directly', () => {
    expect(parseDuration(1000)).toBe(1000);
    expect(parseDuration(500)).toBe(500);
    expect(parseDuration(60000)).toBe(60000);
    expect(parseDuration(100.4)).toBe(100);
  });

  it('should parse purely numeric strings as milliseconds', () => {
    expect(parseDuration('5000')).toBe(5000);
    expect(parseDuration('120000')).toBe(120000);
  });

  it('should parse human-readable duration strings accurately', () => {
    expect(parseDuration('500ms')).toBe(500);
    expect(parseDuration('10s')).toBe(10_000);
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('1m')).toBe(60_000);
    expect(parseDuration('5m')).toBe(300_000);
    expect(parseDuration('10m')).toBe(600_000);
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration('2h')).toBe(7_200_000);
    expect(parseDuration('1d')).toBe(86_400_000);
  });

  it('should parse compound durations', () => {
    expect(parseDuration('1m 30s')).toBe(90_000);
    expect(parseDuration('1h 15m')).toBe(4_500_000);
    expect(parseDuration('2d 12h')).toBe(216_000_000);
  });

  it('should handle fractional units', () => {
    expect(parseDuration('1.5s')).toBe(1500);
    expect(parseDuration('0.5m')).toBe(30_000);
    expect(parseDuration('2.5h')).toBe(9_000_000);
  });

  it('should throw error for zero or negative values', () => {
    expect(() => parseDuration(0)).toThrow(RangeError);
    expect(() => parseDuration(-500)).toThrow(RangeError);
    expect(() => parseDuration('0s')).toThrow(RangeError);
    expect(() => parseDuration('0m')).toThrow(RangeError);
    expect(() => parseDuration('0')).toThrow(RangeError);
  });

  it('should throw error for invalid or empty inputs', () => {
    expect(() => parseDuration('')).toThrow(RangeError);
    expect(() => parseDuration('   ')).toThrow(RangeError);
    // @ts-expect-error test invalid type
    expect(() => parseDuration(null)).toThrow(TypeError);
    // @ts-expect-error test invalid type
    expect(() => parseDuration(undefined)).toThrow(TypeError);
    expect(() => parseDuration(NaN)).toThrow(RangeError);
    expect(() => parseDuration(Infinity)).toThrow(RangeError);
  });

  it('should throw error for unknown units or malformed strings', () => {
    expect(() => parseDuration('10x')).toThrow(RangeError);
    expect(() => parseDuration('invalid')).toThrow(RangeError);
    expect(() => parseDuration('10years')).toThrow(RangeError);
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(142)).toBe('142ms');
  });

  it('should format seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(30000)).toBe('30s');
  });

  it('should format minutes and compound parts', () => {
    expect(formatDuration(60000)).toBe('1m');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(600000)).toBe('10m');
  });

  it('should format hours and days', () => {
    expect(formatDuration(3600000)).toBe('1h');
    expect(formatDuration(86400000)).toBe('1d');
    expect(formatDuration(90000000)).toBe('1d 1h');
  });
});
