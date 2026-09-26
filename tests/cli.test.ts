import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { parseArgs, runCli } from '../src/cli.js';

describe('cli module', () => {
  let server: http.Server;
  let serverUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200);
        res.end('ok');
      } else {
        res.writeHead(500);
        res.end('server error');
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

  describe('parseArgs', () => {
    it('should parse long flags properly', () => {
      const argv = [
        'node',
        'service-keepalive',
        '--url',
        'https://example.com/health',
        '--interval',
        '5m',
        '--timeout',
        '10s',
        '--method',
        'POST',
        '--retries',
        '4',
        '--retry-delay',
        '3s',
        '--quiet',
        '--once',
      ];

      const opts = parseArgs(argv);
      expect(opts.url).toBe('https://example.com/health');
      expect(opts.interval).toBe('5m');
      expect(opts.timeout).toBe('10s');
      expect(opts.method).toBe('POST');
      expect(opts.retries).toBe('4');
      expect(opts.retryDelay).toBe('3s');
      expect(opts.quiet).toBe(true);
      expect(opts.once).toBe(true);
    });

    it('should parse shorthand aliases and headers', () => {
      const argv = [
        'node',
        'service-keepalive',
        '-u',
        'https://example.com',
        '-i',
        '15m',
        '-t',
        '45s',
        '-m',
        'HEAD',
        '-r',
        '2',
        '-H',
        'Authorization: Bearer secret',
        '-H',
        'X-App: KeepAlive',
        '-v',
      ];

      const opts = parseArgs(argv);
      expect(opts.url).toBe('https://example.com');
      expect(opts.interval).toBe('15m');
      expect(opts.timeout).toBe('45s');
      expect(opts.method).toBe('HEAD');
      expect(opts.retries).toBe('2');
      expect(opts.verbose).toBe(true);
      expect(opts.headers).toEqual(['Authorization: Bearer secret', 'X-App: KeepAlive']);
    });

    it('should parse positional URL', () => {
      const argv = ['node', 'service-keepalive', 'https://positional.com/health', '-i', '1m'];
      const opts = parseArgs(argv);
      expect(opts.url).toBe('https://positional.com/health');
      expect(opts.interval).toBe('1m');
    });
  });

  describe('runCli', () => {
    it('should return 0 on --help', async () => {
      const code = await runCli(['node', 'service-keepalive', '--help']);
      expect(code).toBe(0);
    });

    it('should return 0 on --version', async () => {
      const code = await runCli(['node', 'service-keepalive', '--version']);
      expect(code).toBe(0);
    });

    it('should return 0 on successful --once execution', async () => {
      const code = await runCli([
        'node',
        'service-keepalive',
        '--url',
        `${serverUrl}/health`,
        '--once',
        '--quiet',
      ]);
      expect(code).toBe(0);
    });

    it('should return 1 on failed --once execution', async () => {
      const code = await runCli([
        'node',
        'service-keepalive',
        '--url',
        `${serverUrl}/bad-endpoint`,
        '--retries',
        '0',
        '--once',
        '--quiet',
      ]);
      expect(code).toBe(1);
    });

    it('should return 1 on invalid config / missing url', async () => {
      const code = await runCli(['node', 'service-keepalive']);
      expect(code).toBe(1);
    });
  });
});
