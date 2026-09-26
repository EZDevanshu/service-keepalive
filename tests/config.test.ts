import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseHeaderPairs,
  normalizeRawConfig,
  loadEnvConfig,
  resolveRuntimeConfig,
} from '../src/config.js';

describe('config module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('parseHeaderPairs', () => {
    it('should parse colon-separated and equals-separated headers', () => {
      const headers = [
        'Authorization: Bearer token123',
        'X-Custom-Header=value456',
        'Content-Type: application/json',
      ];
      const parsed = parseHeaderPairs(headers);
      expect(parsed['Authorization']).toBe('Bearer token123');
      expect(parsed['X-Custom-Header']).toBe('value456');
      expect(parsed['Content-Type']).toBe('application/json');
    });

    it('should throw on invalid format', () => {
      expect(() => parseHeaderPairs(['invalid-header-without-separator'])).toThrow(
        /Invalid header format/,
      );
      expect(() => parseHeaderPairs([': value'])).toThrow(/Header key cannot be empty/);
    });
  });

  describe('normalizeRawConfig', () => {
    it('should normalize single URL configuration', () => {
      const raw = {
        url: 'https://example.com/health',
        interval: '5m',
      };
      const normalized = normalizeRawConfig(raw);
      expect(normalized.services.length).toBe(1);
      expect(normalized.services[0]?.url).toBe('https://example.com/health');
    });

    it('should normalize multi-service configuration', () => {
      const raw = {
        services: [
          { name: 'app1', url: 'https://app1.com/health' },
          { name: 'app2', url: 'https://app2.com/health' },
        ],
        defaults: { timeout: '15s' },
      };
      const normalized = normalizeRawConfig(raw);
      expect(normalized.services.length).toBe(2);
      expect(normalized.defaults?.timeout).toBe('15s');
    });

    it('should throw on empty or invalid structure', () => {
      expect(() => normalizeRawConfig({})).toThrow(/must contain either a "url"/);
      expect(() => normalizeRawConfig({ services: [] })).toThrow(/cannot be empty/);
    });
  });

  describe('loadEnvConfig', () => {
    it('should extract keepalive settings from process.env', () => {
      process.env['KEEPALIVE_URL'] = 'https://env.example.com/health';
      process.env['KEEPALIVE_INTERVAL'] = '15m';
      process.env['KEEPALIVE_RETRIES'] = '5';
      process.env['KEEPALIVE_VERBOSE'] = 'true';

      const envConfig = loadEnvConfig();
      expect(envConfig.url).toBe('https://env.example.com/health');
      expect(envConfig.interval).toBe('15m');
      expect(envConfig.retries).toBe(5);
      expect(envConfig.logLevel).toBe('verbose');
    });
  });

  describe('resolveRuntimeConfig', () => {
    it('should prioritize CLI flags over env variables', async () => {
      process.env['KEEPALIVE_URL'] = 'https://env.example.com/health';
      process.env['KEEPALIVE_INTERVAL'] = '15m';

      const resolved = await resolveRuntimeConfig({
        url: 'https://cli.example.com/health',
        interval: '2m',
      });

      if ('url' in resolved) {
        expect(resolved.url).toBe('https://cli.example.com/health');
        expect(resolved.interval).toBe('2m');
      } else {
        expect.fail('Expected single KeepAliveConfig');
      }
    });

    it('should throw error when no URL is provided anywhere', async () => {
      delete process.env['KEEPALIVE_URL'];
      await expect(resolveRuntimeConfig({})).rejects.toThrow(/Missing target URL/);
    });
  });
});
