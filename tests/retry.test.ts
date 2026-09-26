import { describe, it, expect } from 'vitest';
import { calculateBackoff, sleep } from '../src/retry.js';

describe('calculateBackoff', () => {
  it('should return 0 for attempt <= 0', () => {
    expect(calculateBackoff({ attempt: 0, baseDelayMs: 1000 })).toBe(0);
    expect(calculateBackoff({ attempt: -1, baseDelayMs: 1000 })).toBe(0);
  });

  it('should calculate exponential backoff without jitter accurately', () => {
    const baseDelayMs = 1000;
    expect(
      calculateBackoff({ attempt: 1, baseDelayMs, strategy: 'exponential', jitter: false }),
    ).toBe(1000);
    expect(
      calculateBackoff({ attempt: 2, baseDelayMs, strategy: 'exponential', jitter: false }),
    ).toBe(2000);
    expect(
      calculateBackoff({ attempt: 3, baseDelayMs, strategy: 'exponential', jitter: false }),
    ).toBe(4000);
    expect(
      calculateBackoff({ attempt: 4, baseDelayMs, strategy: 'exponential', jitter: false }),
    ).toBe(8000);
  });

  it('should calculate linear backoff without jitter', () => {
    const baseDelayMs = 1000;
    expect(calculateBackoff({ attempt: 1, baseDelayMs, strategy: 'linear', jitter: false })).toBe(
      1000,
    );
    expect(calculateBackoff({ attempt: 2, baseDelayMs, strategy: 'linear', jitter: false })).toBe(
      2000,
    );
    expect(calculateBackoff({ attempt: 3, baseDelayMs, strategy: 'linear', jitter: false })).toBe(
      3000,
    );
  });

  it('should calculate fixed backoff without jitter', () => {
    const baseDelayMs = 2500;
    expect(calculateBackoff({ attempt: 1, baseDelayMs, strategy: 'fixed', jitter: false })).toBe(
      2500,
    );
    expect(calculateBackoff({ attempt: 2, baseDelayMs, strategy: 'fixed', jitter: false })).toBe(
      2500,
    );
    expect(calculateBackoff({ attempt: 3, baseDelayMs, strategy: 'fixed', jitter: false })).toBe(
      2500,
    );
  });

  it('should cap at maxDelayMs', () => {
    const delay = calculateBackoff({
      attempt: 10,
      baseDelayMs: 5000,
      strategy: 'exponential',
      maxDelayMs: 10000,
      jitter: false,
    });
    expect(delay).toBe(10000);
  });

  it('should apply jitter within ±20% bounds', () => {
    const baseDelayMs = 10000;
    for (let i = 0; i < 20; i++) {
      const delay = calculateBackoff({
        attempt: 1,
        baseDelayMs,
        strategy: 'fixed',
        jitter: true,
      });
      expect(delay).toBeGreaterThanOrEqual(8000);
      expect(delay).toBeLessThanOrEqual(12000);
    }
  });
});

describe('sleep', () => {
  it('should resolve after requested time', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it('should reject immediately if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(1000, controller.signal)).rejects.toThrow('Operation aborted');
  });

  it('should cancel waiting when signal aborts midway', async () => {
    const controller = new AbortController();
    const promise = sleep(1000, controller.signal);
    setTimeout(() => controller.abort(), 20);
    await expect(promise).rejects.toThrow('Operation aborted');
  });
});
