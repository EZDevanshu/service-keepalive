import { defineConfig } from 'tsup';

export default defineConfig([
  // Core Library: Dual ESM & CommonJS with TypeScript declarations
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    outDir: 'dist',
    target: 'node18',
  },
  // CLI Binary: Executable Node.js ESM output with shebang
  {
    entry: {
      bin: 'src/bin.ts',
    },
    format: ['esm'],
    dts: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
    sourcemap: true,
    clean: false,
    treeshake: true,
    splitting: false,
    outDir: 'dist',
    target: 'node18',
  },
]);
