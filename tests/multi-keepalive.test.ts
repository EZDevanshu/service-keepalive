import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { MultiKeepAlive } from '../src/multi-keepalive.js';

describe('MultiKeepAlive', () => {
  let server: http.Server;
  let serverUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/srv1') {
        res.writeHead(200);
        res.end('service 1 ok');
      } else if (req.url === '/srv2') {
        res.writeHead(200);
        res.end('service 2 ok');
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

  it('should initialize and hold multiple services', () => {
    const multi = new MultiKeepAlive({
      services: [
        { name: 'srv1', url: `${serverUrl}/srv1`, interval: '5m' },
        { name: 'srv2', url: `${serverUrl}/srv2`, interval: '10m' },
      ],
      logger: false,
    });

    expect(multi.getServices().length).toBe(2);
    expect(multi.getService('srv1')).toBeDefined();
    expect(multi.getService('srv2')).toBeDefined();
    expect(multi.isRunning()).toBe(false);
  });

  it('should throw if duplicate service names are specified', () => {
    expect(() => {
      new MultiKeepAlive({
        services: [
          { name: 'backend', url: `${serverUrl}/srv1` },
          { name: 'backend', url: `${serverUrl}/srv2` },
        ],
        logger: false,
      });
    }).toThrow(/Duplicate service name/);
  });

  it('should ping all services once in parallel', async () => {
    const multi = new MultiKeepAlive({
      services: [
        { name: 'srv1', url: `${serverUrl}/srv1` },
        { name: 'srv2', url: `${serverUrl}/srv2` },
      ],
      logger: false,
    });

    const results = await multi.pingOnce();
    expect(results.length).toBe(2);
    expect(results.every(r => r.ok)).toBe(true);
    expect(results.map(r => r.serviceName)).toEqual(['srv1', 'srv2']);
  });

  it('should start and stop all child services cleanly', async () => {
    const multi = new MultiKeepAlive({
      services: [
        { name: 'srv1', url: `${serverUrl}/srv1`, interval: '100ms' },
        { name: 'srv2', url: `${serverUrl}/srv2`, interval: '100ms' },
      ],
      logger: false,
    });

    multi.start();
    expect(multi.isRunning()).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 50));

    await multi.stop();
    expect(multi.isRunning()).toBe(false);
  });
});
