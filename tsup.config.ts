import { defineConfig } from 'tsup';
import * as fs from 'fs';
import * as path from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  clean: true,
  minify: true,
  bundle: true,
  noExternal: [/^((?!better-sqlite3|chokidar|fsevents).)*$/], // Bundle all EXCEPT native modules
  external: [
    'better-sqlite3',
    'chokidar',
    'fsevents',
    'arcjet',
    '@arcjet/runtime',
    '@arcjet/analyze-wasm',
    '@arcjet/protocol',
    'express',
    'mongoose',
  ],
  // We need to keep some heavy native or peer modules external to avoid bundling errors,
  // or we can try to inline everything. Let's start by externalizing tricky ones
  // that have natives or dynamic requires.
  onSuccess: async () => {
    // 1. Copy README.md to dist (User request)
    const readmeFile = path.join(__dirname, 'README.md');
    if (fs.existsSync(readmeFile)) {
      fs.copyFileSync(readmeFile, path.join(__dirname, 'dist', 'README.md'));
    }

    // 2. Copy better-sqlite3 native bindings (OPTIONAL)
    if (process.env.BUILD_SQLITE_BINDING === 'true') {
      const distDir = path.join(__dirname, 'dist', 'build', 'Release');
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      const bindingSource = path.join(
        __dirname,
        'node_modules',
        'better-sqlite3',
        'build',
        'Release',
        'better_sqlite3.node',
      );
      if (fs.existsSync(bindingSource)) {
        fs.copyFileSync(
          bindingSource,
          path.join(distDir, 'better_sqlite3.node'),
        );
      } else {
        console.warn(
          '⚠️ Warning: better_sqlite3.node not found in node_modules',
        );
      }
    }

    // 3. Copy any WASM files from src/provider to dist
    const providerDir = path.join(__dirname, 'src', 'provider');
    if (fs.existsSync(providerDir)) {
      const files = fs.readdirSync(providerDir);
      for (const file of files) {
        if (file.endsWith('.wasm')) {
          fs.copyFileSync(
            path.join(providerDir, file),
            path.join(__dirname, 'dist', file),
          );
        }
      }
    }
  },
});
