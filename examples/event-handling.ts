import { KeepAlive } from '../src/index.js';

const keepAlive = new KeepAlive({
  url: 'https://backend.example.com/health',
  interval: '10m',
  retries: 3,
});

// Register listeners for lifecycle and telemetry events
keepAlive.on('start', serviceName => {
  console.log(`[EVENT:START] Started monitoring ${serviceName}`);
});

keepAlive.on('ping', info => {
  console.log(`[EVENT:PING] Sending ping to ${info.url} (Attempt ${info.attempt})`);
});

keepAlive.on('success', result => {
  console.log(`[EVENT:SUCCESS] Got HTTP ${result.status} in ${result.durationMs}ms`);
});

keepAlive.on('retry', info => {
  console.warn(
    `[EVENT:RETRY] Ping failed: ${info.error}. Retrying attempt ${info.attempt}/${info.maxRetries} in ${info.delayMs}ms`,
  );
});

keepAlive.on('failure', result => {
  console.error(
    `[EVENT:FAILURE] Ping permanently failed for ${result.serviceName}: ${result.error}`,
  );
});

keepAlive.on('stop', serviceName => {
  console.log(`[EVENT:STOP] Stopped monitoring ${serviceName}`);
});

keepAlive.start();
