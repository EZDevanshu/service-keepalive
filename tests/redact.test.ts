import { describe, it, expect } from 'vitest';
import { redactHeaders, redactUrl } from '../src/utils/redact.js';

describe('redactHeaders', () => {
  it('should mask sensitive authorization and secret headers', () => {
    const headers = {
      'User-Agent': 'service-keepalive',
      Authorization: 'Bearer supersecrettoken',
      'X-Api-Key': 'key_123456789',
      Cookie: 'sessionid=abcdef',
      'Content-Type': 'application/json',
      'X-Secret-Token': 'pass123',
    };

    const redacted = redactHeaders(headers);

    expect(redacted['User-Agent']).toBe('service-keepalive');
    expect(redacted['Content-Type']).toBe('application/json');
    expect(redacted['Authorization']).toBe('[REDACTED]');
    expect(redacted['X-Api-Key']).toBe('[REDACTED]');
    expect(redacted['Cookie']).toBe('[REDACTED]');
    expect(redacted['X-Secret-Token']).toBe('[REDACTED]');
  });

  it('should handle null or undefined headers safely', () => {
    expect(redactHeaders(null)).toEqual({});
    expect(redactHeaders(undefined)).toEqual({});
  });
});

describe('redactUrl', () => {
  it('should mask sensitive query parameters in URLs', () => {
    const url = 'https://api.example.com/health?token=secret123&env=prod&apikey=987';
    const redacted = redactUrl(url);

    expect(redacted).toContain('token=%5BREDACTED%5D');
    expect(redacted).toContain('apikey=%5BREDACTED%5D');
    expect(redacted).toContain('env=prod');
  });

  it('should leave URLs without sensitive parameters unchanged', () => {
    const url = 'https://api.example.com/health?version=1.0.0';
    expect(redactUrl(url)).toBe(url);
  });

  it('should handle invalid URLs safely without crashing', () => {
    expect(redactUrl('not-a-valid-url')).toBe('not-a-valid-url');
  });
});
