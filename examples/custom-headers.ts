import { KeepAlive } from '../src/index.js';

// Keep-alive with custom headers, HTTP method, and payload
const keepAlive = new KeepAlive({
  url: 'https://api.example.com/heartbeat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer YOUR_SECRET_TOKEN', // Automatically redacted in logs
    'X-Client-Source': 'keepalive-bot',
  },
  body: JSON.stringify({ source: 'cron-runner', ping: true }),
  interval: '5m',
  timeout: '15s',
  retries: 2,
});

keepAlive.start();
