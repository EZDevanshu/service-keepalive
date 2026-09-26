import { MultiKeepAlive } from '../src/index.js';

// Initialize keep-alive manager for multiple independent services
const multi = new MultiKeepAlive({
  defaults: {
    timeout: '30s',
    retries: 3,
    retryDelay: '5s',
  },
  services: [
    {
      name: 'api-gateway',
      url: 'https://api.example.com/health',
      interval: '10m',
    },
    {
      name: 'auth-service',
      url: 'https://auth.example.com/status',
      interval: '15m',
    },
    {
      name: 'worker-node',
      url: 'https://worker.example.com/ping',
      interval: '5m',
    },
  ],
});

// Start keeping all services alive
multi.start();

// Graceful termination
process.on('SIGINT', async () => {
  console.log('\nShutting down all services...');
  await multi.stop();
  process.exit(0);
});
