import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const mode = process.argv[2] || 'dev';
const port = process.env.PORT || '3001';
const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const child = spawn(process.execPath, [nextBin, mode, '-p', port], {
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
