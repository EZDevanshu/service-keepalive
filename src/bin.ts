import { runCli } from './cli.js';

runCli()
  .then(code => {
    if (code !== 0) {
      process.exit(code);
    }
  })
  .catch(err => {
    console.error('Fatal keepalive error:', err);
    process.exit(1);
  });
