import { CliOptions } from './types.js';
import { resolveRuntimeConfig } from './config.js';
import { KeepAlive } from './keepalive.js';
import { MultiKeepAlive } from './multi-keepalive.js';

const VERSION = '1.0.0';

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    headers: [],
  };

  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-V' || arg === '--version') {
      options.version = true;
    } else if (arg === '-q' || arg === '--quiet') {
      options.quiet = true;
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--once') {
      options.once = true;
    } else if (arg === '-u' || arg === '--url') {
      options.url = args[++i];
    } else if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg === '-i' || arg === '--interval') {
      options.interval = args[++i];
    } else if (arg.startsWith('--interval=')) {
      options.interval = arg.split('=')[1];
    } else if (arg === '-t' || arg === '--timeout') {
      options.timeout = args[++i];
    } else if (arg.startsWith('--timeout=')) {
      options.timeout = arg.split('=')[1];
    } else if (arg === '-m' || arg === '--method') {
      options.method = args[++i];
    } else if (arg.startsWith('--method=')) {
      options.method = arg.split('=')[1];
    } else if (arg === '-r' || arg === '--retries') {
      options.retries = args[++i];
    } else if (arg.startsWith('--retries=')) {
      options.retries = arg.split('=')[1];
    } else if (arg === '--retry-delay') {
      options.retryDelay = args[++i];
    } else if (arg.startsWith('--retry-delay=')) {
      options.retryDelay = arg.split('=')[1];
    } else if (arg === '-H' || arg === '--header') {
      const headerVal = args[++i];
      if (headerVal) options.headers?.push(headerVal);
    } else if (arg.startsWith('--header=')) {
      const headerVal = arg.split('=')[1];
      if (headerVal) options.headers?.push(headerVal);
    } else if (arg === '-c' || arg === '--config') {
      options.config = args[++i];
    } else if (arg.startsWith('--config=')) {
      options.config = arg.split('=')[1];
    } else if (!arg.startsWith('-') && !options.url) {
      // Positional URL support: service-keepalive https://example.com/health
      options.url = arg;
    }
  }

  return options;
}

export function printHelp(): void {
  console.log(`
\x1b[1m\x1b[36mservice-keepalive\x1b[0m v${VERSION}
Lightweight HTTP keep-alive utility to prevent idle spin-down on services with inbound traffic wakeups.

\x1b[1mUSAGE:\x1b[0m
  $ npx service-keepalive [options]
  $ npx service-keepalive <url> [options]

\x1b[1mOPTIONS:\x1b[0m
  -u, --url <url>             Target service URL (e.g. https://example.onrender.com/health)
  -i, --interval <duration>   Interval between pings (e.g. 10s, 1m, 5m, 10m, 1h) [default: 10m]
  -t, --timeout <duration>    Request timeout duration (e.g. 10s, 30s, 1m) [default: 30s]
  -m, --method <method>       HTTP method (GET, POST, HEAD, etc.) [default: GET]
  -r, --retries <number>      Number of retry attempts on failure [default: 3]
      --retry-delay <duration> Base delay between retries [default: 5s]
  -H, --header <key:value>    Custom request header (can be used multiple times)
  -c, --config <path>         Path to JSON or JS config file [default: keepalive.config.json]
      --once                  Execute a single ping and exit (useful for cron jobs / CI)
  -q, --quiet                 Suppress standard output; only log failures
  -v, --verbose               Enable verbose debug logging
  -V, --version               Output version number
  -h, --help                  Display this help message

\x1b[1mEXAMPLES:\x1b[0m
  $ npx service-keepalive --url https://api.example.com/health --interval 10m
  $ npx service-keepalive -u https://api.example.com/health -H "Authorization: Bearer mytoken"
  $ npx service-keepalive --config keepalive.config.json
  $ npx service-keepalive --url https://api.example.com/health --once

\x1b[1mENVIRONMENT VARIABLES:\x1b[0m
  KEEPALIVE_URL, KEEPALIVE_INTERVAL, KEEPALIVE_TIMEOUT, KEEPALIVE_METHOD,
  KEEPALIVE_RETRIES, KEEPALIVE_HEADERS, KEEPALIVE_CONFIG, KEEPALIVE_QUIET, KEEPALIVE_VERBOSE

\x1b[1mNOTE:\x1b[0m
  This tool runs externally (on your machine, VPS, Docker container, or CI runner).
  Always ensure compliance with your hosting provider's Terms of Service.
`);
}

export async function runCli(argv = process.argv): Promise<number> {
  const options = parseArgs(argv);

  if (options.help) {
    printHelp();
    return 0;
  }

  if (options.version) {
    console.log(`service-keepalive v${VERSION}`);
    return 0;
  }

  try {
    const config = await resolveRuntimeConfig(options);

    let runner: KeepAlive | MultiKeepAlive;

    if ('services' in config) {
      runner = new MultiKeepAlive(config);
    } else {
      runner = new KeepAlive(config);
    }

    // Graceful termination handling
    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\nReceived ${signal}. Stopping keep-alive...`);
      await runner.stop();
      console.log('Stopped successfully.');
      process.exit(0);
    };

    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.once('SIGTERM', () => void shutdown('SIGTERM'));

    // Handle single-ping execution mode
    if (options.once) {
      if (runner instanceof MultiKeepAlive) {
        const results = await runner.pingOnce();
        const allOk = results.every(r => r.ok);
        return allOk ? 0 : 1;
      } else {
        const result = await runner.pingOnce();
        return result.ok ? 0 : 1;
      }
    }

    // Continuous running mode
    runner.start();

    // Return a promise that stays active until process receives a termination signal
    return new Promise<number>(() => {
      // Keep running
    });
  } catch (err) {
    console.error(`\x1b[31mError:\x1b[0m ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}
