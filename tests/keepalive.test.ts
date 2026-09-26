import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { KeepAlive } from '../src/keepalive.js';
import { PingResult } from '../src/types.js';

describe('KeepAlive', () => {
  let server: http.Server;
  let serverUrl: string;
  let requestCount = 0;
  let failFirstNRequests = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requestCount++;
      if (failFirstNRequests > 0) {
        failFirstNRequests--;
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Service Unavailable');
        return;
      }

      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy' }));
      } else {
        res.writeHead(404);
        res.end();
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

  it('should not start running automatically on instantiation', () => {
    const instance = new KeepAlive({
      url: `${serverUrl}/health`,
      interval: '10m',
      logger: false,
    });

    expect(instance.isRunning()).toBe(false);
  });

  it('should throw on invalid options or invalid URL', () => {
    // @ts-expect-error test invalid options
    expect(() => new KeepAlive()).toThrow(TypeError);
    // @ts-expect-error test invalid URL
    expect(() => new KeepAlive({ url: '' })).toThrow(TypeError);
    expect(() => new KeepAlive({ url: 'ftp://example.com' })).toThrow(Error);
  });

  it('should execute pingOnce successfully', async () => {
    const instance = new KeepAlive({
      url: `${serverUrl}/health`,
      logger: false,
    });

    const result = await instance.pingOnce();
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(instance.isRunning()).toBe(false);
  });

  it('should start and emit events properly', async () => {
    const instance = new KeepAlive({
      url: `${serverUrl}/health`,
      interval: '100ms',
      logger: false,
    });

    const events: string[] = [];
    instance.on('start', () => events.push('start'));
    instance.on('ping', () => events.push('ping'));
    instance.on('success', () => events.push('success'));
    instance.on('stop', () => events.push('stop'));

    instance.start();
    expect(instance.isRunning()).toBe(true);

    // Wait a brief moment to allow first ping to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(events).toContain('start');
    expect(events).toContain('ping');
    expect(events).toContain('success');

    await instance.stop();
    expect(instance.isRunning()).toBe(false);
    expect(events).toContain('stop');
  });

  it('should retry on initial failure and succeed once service recovers', async () => {
    failFirstNRequests = 2; // fail 2 times, then succeed on 3rd attempt
    requestCount = 0;

    const retryEvents: number[] = [];
    const instance = new KeepAlive({
      url: `${serverUrl}/health`,
      retries: 3,
      retryDelay: '20ms',
      retryJitter: false,
      logger: false,
    });

    instance.on('retry', info => {
      retryEvents.push(info.attempt);
    });

    const result = await instance.pingOnce();
    expect(result.ok).toBe(true);
    expect(result.attempt).toBe(3);
    expect(retryEvents).toEqual([1, 2]);
    expect(requestCount).toBe(3);
  });

  it('should emit failure when all retries are exhausted', async () => {
    failFirstNRequests = 10; // fail more than max retries
    const failures: PingResult[] = [];

    const instance = new KeepAlive({
      url: `${serverUrl}/health`,
      retries: 2,
      retryDelay: '10ms',
      retryJitter: false,
      logger: false,
    });

    instance.on('failure', result => {
      failures.push(result);
    });

    const result = await instance.pingOnce();
    expect(result.ok).toBe(false);
    expect(failures.length).toBe(1);
    expect(failures[0]?.status).toBe(503);
  });
});
