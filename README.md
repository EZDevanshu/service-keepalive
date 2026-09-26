# service-keepalive

> Production-ready, lightweight HTTP keep-alive utility and CLI to prevent idle service spin-down on cloud platforms where inbound traffic maintains active status.

[![npm version](https://img.shields.io/npm/v/service-keepalive.svg?style=flat-square)](https://www.npmjs.com/package/service-keepalive)
[![CI](https://github.com/EZDevanshu/service-keepalive/actions/workflows/ci.yml/badge.svg)](https://github.com/EZDevanshu/service-keepalive/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/service-keepalive.svg?style=flat-square)](https://nodejs.org)

---

## What is it?

Many cloud hosting platforms (such as **Render**, **Fly.io**, **Railway**, or **Koyeb**) offer free or hobby-tier web services that automatically spin down into an idle state after 15–30 minutes of inactivity. When a new user requests the service, it can suffer a cold-start delay of 30–60 seconds while the container wakes up.

`service-keepalive` periodically sends lightweight HTTP requests to your deployed web service so that inbound traffic keeps the service warm and responsive.

### ⚠️ IMPORTANT: External Execution Model

```
 ┌─────────────────────────────────────────────────────────┐
 │  EXTERNAL RUNNER (Where service-keepalive MUST run)     │
 │                                                         │
 │  • Your Local PC / Mac / Raspberry Pi                   │
 │  • VPS (DigitalOcean, Hetzner, AWS EC2, Linode, etc.)   │
 │  • GitHub Actions Scheduled Workflow (Cron)             │
 │  • Docker Container on home server / NAS                │
 └────────────────────────────┬────────────────────────────┘
                              │
                  Periodic HTTP Pings (e.g. every 10m)
                              │
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │  TARGET CLOUD SERVICE (e.g. Render, Railway, Fly.io)    │
 │                                                         │
 │  • Web API / Backend Server                             │
 │  • Woken up & kept active by inbound HTTP traffic       │
 └─────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **This package is NOT hosted inside your target server.**
>
> It must run **externally** (on your local machine, a separate VPS, a Docker container, or a scheduled CI runner like GitHub Actions). If your server is asleep, internal background timers cannot wake it up. An **external** inbound request is required.

---

## Hosting Provider Policy & Terms of Service

> [!WARNING]
>
> - **Compliance**: Always check your hosting provider’s **Terms of Service (ToS)**, Acceptable Use Policy, and free-tier limits before setting up keep-alive pings.
> - **Free Tier Quotas**: Free-tier plans often have a monthly quota of active instance hours (e.g., Render provides 750 free instance hours per month shared across all your free web services). Keeping a service active 24/7 consumes 720–744 hours per month, which may deplete your free tier allowance for other services.
> - **No Guarantees**: This package does **not** bypass provider-level billing or platform restrictions, nor does it guarantee 100% uptime. Platforms can modify their sleep policies at any time.

---

## Features

- ⚡ **Zero Heavy Dependencies**: Uses Node.js native `fetch` and lightweight utilities.
- 🕒 **Human-Readable Intervals**: Accepts durations like `10s`, `1m`, `5m`, `10m`, `1h`, or numeric milliseconds.
- 🔄 **Configurable Retries & Backoff**: Exponential, linear, or fixed backoff with jitter to handle intermittent network hiccups gracefully.
- 🛡️ **Timeout & AbortController**: Every ping is guarded by a configurable timeout so requests never hang indefinitely.
- 🔒 **Security-First**: Automatically redacts authorization headers, API keys, cookies, and secret tokens in logs.
- 🚦 **Multiple Services**: Keep one or dozens of endpoints warm with individual or shared schedules.
- 💻 **CLI & NPX Ready**: Instant execution with zero setup using `npx service-keepalive`.
- 📦 **Dual ESM & CommonJS**: Full compatibility with modern ESM projects and legacy CommonJS runtimes.
- 🛑 **Graceful Shutdown**: Intercepts `SIGINT` (Ctrl+C) and `SIGTERM` to safely clean up in-flight requests and timers.
- 🤖 **GitHub Actions & Docker**: Ready-to-use scheduled workflow and multi-stage container image.

---

## Installation

### Run directly without installation (CLI)

```bash
npx service-keepalive --url https://example.onrender.com/health --interval 10m
```

### Install globally (CLI)

```bash
npm install -g service-keepalive
service-keepalive --url https://example.onrender.com/health
```

### Install as project dependency (Library API)

```bash
npm install service-keepalive
```

---

## CLI Usage

### Basic Command

```bash
service-keepalive --url https://example.onrender.com/health --interval 10m
```

### CLI Flags & Options

| Option                     | Shorthand | Description                                        | Default                 |
| :------------------------- | :-------- | :------------------------------------------------- | :---------------------- |
| `--url <url>`              | `-u`      | Target endpoint URL to ping                        | _Required_              |
| `--interval <duration>`    | `-i`      | Interval between pings (`10s`, `5m`, `10m`, `1h`)  | `10m`                   |
| `--timeout <duration>`     | `-t`      | Request timeout before aborting (`10s`, `30s`)     | `30s`                   |
| `--method <method>`        | `-m`      | HTTP method (`GET`, `POST`, `HEAD`, etc.)          | `GET`                   |
| `--retries <number>`       | `-r`      | Number of retry attempts on failure                | `3`                     |
| `--retry-delay <duration>` |           | Base delay before retrying failed requests         | `5s`                    |
| `--header <key:value>`     | `-H`      | Custom header (can be specified multiple times)    |                         |
| `--config <path>`          | `-c`      | Path to JSON or JS configuration file              | `keepalive.config.json` |
| `--once`                   |           | Execute a single ping cycle and exit (for Cron/CI) | `false`                 |
| `--quiet`                  | `-q`      | Suppress routine logs; only output errors          | `false`                 |
| `--verbose`                | `-v`      | Enable detailed debug logs and response headers    | `false`                 |
| `--help`                   | `-h`      | Display help screen                                |                         |
| `--version`                | `-V`      | Output package version                             |                         |

### CLI Examples

```bash
# Ping every 5 minutes with a 15-second timeout
npx service-keepalive -u https://api.example.com/health -i 5m -t 15s

# Send custom headers (e.g. authentication or custom user-agent)
npx service-keepalive -u https://api.example.com/health -H "Authorization: Bearer mytoken" -H "X-Client: KeepAlive"

# Run a single ping check (exits with code 0 on success, 1 on failure)
npx service-keepalive -u https://api.example.com/health --once

# Run using a configuration file
npx service-keepalive --config keepalive.config.json
```

---

## Library Usage

### TypeScript Example

```typescript
import { KeepAlive, PingResult } from 'service-keepalive';

const keepAlive = new KeepAlive({
  url: 'https://example.onrender.com/health',
  interval: '10m', // Ping every 10 minutes
  timeout: '30s', // 30s timeout per request
  method: 'GET',
  retries: 3,
  retryDelay: '5s',
  headers: {
    'User-Agent': 'service-keepalive-bot/1.0',
  },
});

// Listen to lifecycle and telemetry events
keepAlive.on('start', name => console.log(`Started keepalive for ${name}`));
keepAlive.on('ping', ({ url, attempt }) => console.log(`Pinging ${url} (Attempt ${attempt})`));
keepAlive.on('success', (result: PingResult) =>
  console.log(`✓ ${result.status} in ${result.durationMs}ms`),
);
keepAlive.on('failure', (result: PingResult) => console.error(`✗ Failed: ${result.error}`));
keepAlive.on('retry', info =>
  console.warn(`↻ Retrying in ${info.delayMs}ms due to: ${info.error}`),
);

// Explicitly start the keep-alive scheduler
keepAlive.start();

// Gracefully stop whenever needed
// await keepAlive.stop();
```

### JavaScript (ESM) Example

```javascript
import { KeepAlive } from 'service-keepalive';

const keepAlive = new KeepAlive({
  url: 'https://api.example.com/health',
  interval: '5m',
});

keepAlive.start();
```

### JavaScript (CommonJS) Example

```javascript
const { KeepAlive } = require('service-keepalive');

const keepAlive = new KeepAlive({
  url: 'https://api.example.com/health',
  interval: '5m',
});

keepAlive.start();
```

---

## Multiple Services

Manage and ping multiple endpoints concurrently with unified or per-service schedules using `MultiKeepAlive`:

```typescript
import { MultiKeepAlive } from 'service-keepalive';

const multi = new MultiKeepAlive({
  // Global defaults applied to all services
  defaults: {
    timeout: '30s',
    retries: 3,
    retryDelay: '5s',
  },
  services: [
    {
      name: 'backend-api',
      url: 'https://backend.example.onrender.com/health',
      interval: '10m',
    },
    {
      name: 'auth-service',
      url: 'https://auth.example.onrender.com/status',
      interval: '15m',
    },
    {
      name: 'worker-node',
      url: 'https://worker.example.onrender.com/ping',
      interval: '5m',
    },
  ],
});

// Starts keep-alive for all services
multi.start();

// Stop all services when shutting down
process.on('SIGINT', async () => {
  await multi.stop();
  process.exit(0);
});
```

---

## Configuration File

You can store your settings in a configuration file (`keepalive.config.json` or `keepalive.config.js`).

### Example `keepalive.config.json`

```json
{
  "defaults": {
    "timeout": "30s",
    "retries": 3,
    "retryDelay": "5s",
    "retryStrategy": "exponential"
  },
  "services": [
    {
      "name": "backend-api",
      "url": "https://example.onrender.com/health",
      "interval": "10m"
    },
    {
      "name": "auth-service",
      "url": "https://auth.example.com/status",
      "interval": "15m",
      "headers": {
        "User-Agent": "service-keepalive/custom"
      }
    }
  ]
}
```

Run with:

```bash
npx service-keepalive
# Or with explicit config path:
npx service-keepalive --config ./path/to/keepalive.config.json
```

---

## Environment Variables

All primary settings can be configured via environment variables:

| Variable                | Description                             | Example                               |
| :---------------------- | :-------------------------------------- | :------------------------------------ |
| `KEEPALIVE_URL`         | Target service URL                      | `https://example.onrender.com/health` |
| `KEEPALIVE_INTERVAL`    | Ping interval                           | `10m`                                 |
| `KEEPALIVE_TIMEOUT`     | Request timeout                         | `30s`                                 |
| `KEEPALIVE_METHOD`      | HTTP method                             | `GET`                                 |
| `KEEPALIVE_RETRIES`     | Max retries                             | `3`                                   |
| `KEEPALIVE_RETRY_DELAY` | Base retry delay                        | `5s`                                  |
| `KEEPALIVE_HEADERS`     | Headers (JSON or comma-separated pairs) | `{"Authorization":"Bearer ..."}`      |
| `KEEPALIVE_CONFIG`      | Path to configuration file              | `./keepalive.config.json`             |
| `KEEPALIVE_QUIET`       | Suppress routine logs                   | `true`                                |
| `KEEPALIVE_VERBOSE`     | Enable debug logs                       | `true`                                |

---

## GitHub Actions

You can use GitHub Actions to ping your service periodically for free without hosting a long-running daemon.

> [!NOTE]
> **Schedule Delays / Jitter**: GitHub Actions cron schedules run on a best-effort basis. During high GitHub infrastructure load, scheduled runs may occasionally be delayed by a few minutes.

Create `.github/workflows/keepalive.yml`:

```yaml
name: Service Keep-Alive

on:
  schedule:
    # Run every 10 minutes
    - cron: '*/10 * * * *'
  workflow_dispatch:

jobs:
  keepalive:
    name: Ping Service
    runs-on: ubuntu-latest
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Execute Ping
        env:
          TARGET_URL: ${{ secrets.KEEPALIVE_URL }}
        run: |
          npx service-keepalive "$TARGET_URL" --timeout 30s --retries 3 --once
```

---

## Docker Support

A lightweight Dockerfile is included for running `service-keepalive` as a background container on your VPS, server, or Raspberry Pi.

### Build the image

```bash
docker build -t service-keepalive .
```

### Run the container

```bash
docker run -d \
  --name keepalive \
  --restart unless-stopped \
  -e KEEPALIVE_URL="https://example.onrender.com/health" \
  -e KEEPALIVE_INTERVAL="10m" \
  service-keepalive
```

---

## Configuration Reference

| Property              | Type                                   | Default         | Description                                                |
| :-------------------- | :------------------------------------- | :-------------- | :--------------------------------------------------------- |
| `url`                 | `string`                               | _Required_      | Target URL to ping (http or https)                         |
| `name`                | `string`                               | URL hostname    | Friendly identifier for logs and events                    |
| `interval`            | `string \| number`                     | `'10m'`         | Interval between consecutive pings (`10s`, `5m`, `1h`, ms) |
| `timeout`             | `string \| number`                     | `'30s'`         | Request timeout duration before aborting                   |
| `method`              | `string`                               | `'GET'`         | HTTP request method (`GET`, `POST`, `HEAD`, etc.)          |
| `headers`             | `Record<string, string>`               | `{}`            | Custom request headers                                     |
| `body`                | `string \| null`                       | `null`          | Optional request body for POST/PUT requests                |
| `retries`             | `number`                               | `3`             | Max retry attempts upon failure                            |
| `retryDelay`          | `string \| number`                     | `'5s'`          | Initial base delay before retrying                         |
| `retryStrategy`       | `'exponential' \| 'linear' \| 'fixed'` | `'exponential'` | Delay calculation algorithm                                |
| `retryJitter`         | `boolean`                              | `true`          | Applies ±20% randomization to prevent request collisions   |
| `maxRetryDelay`       | `string \| number`                     | `'60s'`         | Maximum upper boundary for retry delays                    |
| `expectedStatusCodes` | `number[] \| Function`                 | `200..299`      | Status codes considered successful                         |
| `logLevel`            | `'quiet' \| 'normal' \| 'verbose'`     | `'normal'`      | Terminal logging verbosity                                 |
| `logger`              | `LoggerInterface \| false`             | Built-in        | Custom logger instance or `false` to disable               |
| `unrefTimer`          | `boolean`                              | `false`         | Whether timers allow Node event loop to exit               |

---

## Troubleshooting

### 1. "Request timed out after 30000ms"

- **Cause**: The service was spun down and cold-starting, taking longer than the configured timeout to boot and respond.
- **Solution**: Increase the timeout setting to `60s` or `90s` (e.g. `--timeout 60s`).

### 2. "Request failed - HTTP 404 / 500"

- **Cause**: The target health check URL path does not exist on your service or your server threw an unhandled error.
- **Solution**: Verify the endpoint URL in your browser or curl (e.g. ensure `/health` or `/` returns a 200 OK status).

### 3. "My service still spun down despite keep-alive pings"

- **Cause 1**: The interval might be too long (e.g., your provider spins down after 15 minutes, but your interval was 20m). Set interval to `10m` or `5m`.
- **Cause 2**: You might have exhausted your monthly free-tier instance hours.
- **Cause 3**: Ensure `service-keepalive` is running **externally**, not deployed within the sleeping instance itself.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and testing guidelines.

## License

This project is licensed under the [MIT License](LICENSE).
