import { KeepAlive } from '../src/index.js';

async function main() {
  const keepAlive = new KeepAlive({
    url: 'https://example.onrender.com/health',
    timeout: '15s',
    retries: 2,
  });

  console.log('Executing one-off health ping...');
  const result = await keepAlive.pingOnce();

  if (result.ok) {
    console.log(`✓ Service is active! Status: ${result.status} (${result.durationMs}ms)`);
    process.exit(0);
  } else {
    console.error(`✗ Ping failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
