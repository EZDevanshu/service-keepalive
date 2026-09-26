import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { executePing, isStatusSuccessful } from '../src/http-client.js';

describe('http-client', () => {
  let server: http.Server;
  let serverUrl: string;
  let lastReceivedHeaders: http.IncomingHttpHeaders = {};
  let lastReceivedMethod = '';

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      lastReceivedHeaders = req.headers;
      lastReceivedMethod = req.method || '';

      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Custom-Header': 'pong' });
        res.end(JSON.stringify({ status: 'ok' }));
      } else if (req.url === '/error') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else if (req.url === '/not-found') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else if (req.url === '/slow') {
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('delayed response');
        }, 1500);
      } else if (req.url === '/custom-status') {
        res.writeHead(302, { Location: '/health' });
        res.end();
      } else {
        res.writeHead(200);
        res.end('OK');
      }
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as { port: number; address: string };
        serverUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  });

  describe('isStatusSuccessful', () => {
    it('should default to 2xx status codes', () => {
      expect(isStatusSuccessful(200)).toBe(true);
      expect(isStatusSuccessful(201)).toBe(true);
      expect(isStatusSuccessful(204)).toBe(true);
      expect(isStatusSuccessful(301)).toBe(false);
      expect(isStatusSuccessful(400)).toBe(false);
      expect(isStatusSuccessful(500)).toBe(false);
    });

    it('should support array of allowed status codes', () => {
      expect(isStatusSuccessful(302, [200, 302])).toBe(true);
      expect(isStatusSuccessful(200, [200, 302])).toBe(true);
      expect(isStatusSuccessful(201, [200, 302])).toBe(false);
    });

    it('should support predicate function', () => {
      expect(isStatusSuccessful(304, s => s < 400)).toBe(true);
      expect(isStatusSuccessful(404, s => s < 400)).toBe(false);
    });
  });

  describe('executePing', () => {
    it('should successfully ping a 200 OK endpoint', async () => {
      const result = await executePing({
        serviceName: 'test-service',
        url: `${serverUrl}/health`,
        method: 'GET',
        timeoutMs: 3000,
        headers: { 'X-Custom-Request': 'keepalive-test' },
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.statusText).toBe('OK');
      expect(result.serviceName).toBe('test-service');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(lastReceivedHeaders['x-custom-request']).toBe('keepalive-test');
      expect(lastReceivedMethod).toBe('GET');
    });

    it('should record failure on 500 status', async () => {
      const result = await executePing({
        serviceName: 'test-service',
        url: `${serverUrl}/error`,
        method: 'GET',
        timeoutMs: 3000,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.error).toContain('500');
    });

    it('should handle request timeout using AbortController', async () => {
      const result = await executePing({
        serviceName: 'test-service',
        url: `${serverUrl}/slow`,
        method: 'GET',
        timeoutMs: 150, // lower than server delay of 1500ms
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(0);
      expect(result.error).toContain('timed out');
    });

    it('should cancel immediately when external signal triggers', async () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 50);

      const result = await executePing({
        serviceName: 'test-service',
        url: `${serverUrl}/slow`,
        method: 'GET',
        timeoutMs: 5000,
        externalSignal: controller.signal,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should handle custom methods like HEAD or POST', async () => {
      const result = await executePing({
        serviceName: 'test-service',
        url: `${serverUrl}/health`,
        method: 'HEAD',
        timeoutMs: 3000,
      });

      expect(result.ok).toBe(true);
      expect(lastReceivedMethod).toBe('HEAD');
    });

    it('should fail gracefully on unreachable port / network error', async () => {
      const result = await executePing({
        serviceName: 'dead-service',
        url: 'http://127.0.0.1:54321/nowhere',
        method: 'GET',
        timeoutMs: 2000,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(0);
      expect(result.error).toBeDefined();
    });
  });
});
