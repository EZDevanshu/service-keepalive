import { KeepAlive } from '../src/index.js';

// Initialize keep-alive for a single service
const keepAlive = new KeepAlive({
  url: 'https://example.onrender.com/health',
  interval: '10m', // Ping every 10 minutes
  timeout: '30s', // Abort if no response within 30 seconds
  retries: 3, // Retry up to 3 times on network failure or non-2xx response
  retryDelay: '5s', // Base backoff delay
});

// Explicitly start the ping schedule
keepAlive.start();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nStopping keep-alive...');
  await keepAlive.stop();
  process.exit(0);
});
