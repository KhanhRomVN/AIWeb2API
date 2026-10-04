/**
 * ------------------------------------------------------------------
 * build-bin.js
 * ------------------------------------------------------------------
 * Build AIWeb2API thành binary cho nhiều OS, đóng gói ZIP.
 *
 * Output structure:
 *   releases/
 *   └── <version>/
 *       ├── AIWeb2API-v<version>-win-x64.zip
 *       ├── AIWeb2API-v<version>-linux-x64.zip
 *       └── AIWeb2API-v<version>-mac-x64.zip
 *
 * Mỗi zip chứa:
 *   RUNME.exe / RUNME        ← binary chính (double-click hoặc ./RUNME)
 *   better_sqlite3.node      ← native addon bắt buộc
 *   resources/               ← WASM và file phụ trợ
 *
 * Usage:
 *   npm run build:release
 * ------------------------------------------------------------------
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Paths ───────────────────────────────────────────────────────────────────

const rootDir  = path.resolve(__dirname, '..');
const distDir  = path.join(rootDir, 'dist');
const releasesDir = path.join(rootDir, 'releases');

// ─── Read version ────────────────────────────────────────────────────────────

const pkgJson  = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version  = pkgJson.version || '0.0.0';
const versionDir = path.join(releasesDir, version);

// ─── Build targets ───────────────────────────────────────────────────────────
// Thêm / bớt target tại đây.
//
// pkgTarget    : target string cho pkg CLI
// platform     : tên platform dùng trong tên file zip
// arch         : tên arch dùng trong tên file zip
// binaryName   : tên file binary trong zip (RUNME.exe hoặc RUNME)
// pkgOutputName: tên file pkg tự sinh ra (tên theo entry point)
// sqliteAddon  : key để map sang prebuilt .node tương ứng (xem SQLITE_ADDONS)
// ─────────────────────────────────────────────────────────────────────────────
const BUILD_TARGETS = [
  // ── Windows ──
  {
    pkgTarget:     'node18-win-x64',
    platform:      'win',
    arch:          'x64',
    binaryName:    'RUNME.exe',
    pkgOutputName: 'index.exe',
    sqliteAddon:   'win-x64',
  },
  // ── Linux ──
  {
    pkgTarget:     'node18-linux-x64',
    platform:      'linux',
    arch:          'x64',
    binaryName:    'RUNME',
    pkgOutputName: 'index',
    sqliteAddon:   'linux-x64',
  },
  {
    pkgTarget:     'node18-linux-arm64',
    platform:      'linux',
    arch:          'arm64',
    binaryName:    'RUNME',
    pkgOutputName: 'index',
    sqliteAddon:   'linux-arm64',
  },
];

// ─── better-sqlite3 prebuilt addon URLs ──────────────────────────────────────
// ABI 108 = Node 18.x
// Xem: https://github.com/WiseLibs/better-sqlite3/releases
const BS3_VERSION = 'v11.8.1';
const BS3_BASE    = `https://github.com/WiseLibs/better-sqlite3/releases/download/${BS3_VERSION}`;

const SQLITE_ADDONS = {
  'win-x64':    { url: `${BS3_BASE}/better-sqlite3-${BS3_VERSION}-node-v108-win32-x64.tar.gz`,    tarName: 'bs3-win-x64.tar.gz'    },
  'linux-x64':  { url: `${BS3_BASE}/better-sqlite3-${BS3_VERSION}-node-v108-linux-x64.tar.gz`,   tarName: 'bs3-linux-x64.tar.gz'  },
  'linux-arm64':{ url: `${BS3_BASE}/better-sqlite3-${BS3_VERSION}-node-v108-linux-arm64.tar.gz`, tarName: 'bs3-linux-arm64.tar.gz' },
  'mac-x64':    { url: `${BS3_BASE}/better-sqlite3-${BS3_VERSION}-node-v108-darwin-x64.tar.gz`,  tarName: 'bs3-mac-x64.tar.gz'    },
  'mac-arm64':  { url: `${BS3_BASE}/better-sqlite3-${BS3_VERSION}-node-v108-darwin-arm64.tar.gz`, tarName: 'bs3-mac-arm64.tar.gz' },
};

// Cache các addon đã download vào resources/
// resources/better_sqlite3_node18_<key>.node
function getAddonPath(key) {
  return path.join(rootDir, 'resources', `better_sqlite3_node18_${key}.node`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(msg);
}

function header(msg) {
  log(`\n${'─'.repeat(60)}`);
  log(msg);
  log('─'.repeat(60));
}

function run(cmd, opts = {}) {
  log(`> ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit', ...opts });
}

function copyWasmFiles(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  for (const item of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, item.name);
    const d = path.join(destDir, item.name);
    if (item.isDirectory()) copyWasmFiles(s, d);
    else if (item.name.endsWith('.wasm')) {
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(s, d);
      log(`  Copied WASM: ${path.relative(rootDir, s)}`);
    }
  }
}

/**
 * Download & extract prebuilt better-sqlite3 .node cho 1 platform.
 * Lưu cache vào resources/better_sqlite3_node18_<key>.node.
 */
function ensureSqliteAddon(key) {
  const dest = getAddonPath(key);
  if (fs.existsSync(dest)) return dest;

  const info = SQLITE_ADDONS[key];
  if (!info) throw new Error(`No SQLite addon config for key: ${key}`);

  log(`  Downloading better-sqlite3 prebuilt for ${key}...`);
  const tarPath = path.join(rootDir, 'resources', info.tarName);
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';

  run(`${curlBin} -fsSL "${info.url}" -o "${tarPath}"`);
  run(`tar -xzf "${tarPath}" -C "${path.join(rootDir, 'resources')}"`);

  // tar giải nén ra build/Release/better_sqlite3.node
  const extracted = path.join(rootDir, 'resources', 'build', 'Release', 'better_sqlite3.node');
  if (!fs.existsSync(extracted)) {
    throw new Error(`Extracted addon not found at ${extracted}`);
  }

  fs.copyFileSync(extracted, dest);
  fs.rmSync(tarPath, { force: true });
  fs.rmSync(path.join(rootDir, 'resources', 'build'), { recursive: true, force: true });

  log(`  Cached: ${path.relative(rootDir, dest)}`);
  return dest;
}

/**
 * Tạo ZIP:
 * - Windows: dùng PowerShell Compress-Archive (built-in)
 * - Linux/macOS: dùng system zip
 */
function zipDirectory(sourceDir, outputZip) {
  if (fs.existsSync(outputZip)) fs.rmSync(outputZip);

  if (process.platform === 'win32') {
    run(
      `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${outputZip}'"`,
    );
  } else {
    execSync(`zip -r "${outputZip}" .`, {
      cwd: sourceDir,
      stdio: 'inherit',
    });
  }
}

// ─── Build 1 target ──────────────────────────────────────────────────────────

function buildTarget(target) {
  const { pkgTarget, platform, arch, binaryName, pkgOutputName, sqliteAddon } = target;
  const zipFileName = `AIWeb2API-v${version}-${platform}-${arch}.zip`;
  const zipFilePath = path.join(versionDir, zipFileName);
  const stagingDir  = path.join(rootDir, `.staging-${platform}-${arch}`);

  header(`Target: ${pkgTarget}  →  ${zipFileName}`);

  // 1. Chuẩn bị staging dir
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  // 2. pkg build
  run(`npx pkg dist/index.js --target ${pkgTarget} --out-path "${stagingDir}"`);

  // 3. Rename binary → RUNME
  const pkgOut  = path.join(stagingDir, pkgOutputName);
  const runme   = path.join(stagingDir, binaryName);
  if (!fs.existsSync(pkgOut)) throw new Error(`pkg output not found: ${pkgOut}`);
  fs.renameSync(pkgOut, runme);
  if (process.platform !== 'win32') fs.chmodSync(runme, 0o755);
  log(`  Renamed: ${pkgOutputName} → ${binaryName}`);

  // 4. Copy better_sqlite3.node
  let addonSrc;
  try {
    addonSrc = ensureSqliteAddon(sqliteAddon);
  } catch (e) {
    // Fallback: dùng addon của host nếu download thất bại
    log(`  ⚠ Could not get prebuilt addon for ${sqliteAddon}: ${e.message}`);
    log(`  ⚠ Falling back to host node_modules addon (may not work cross-platform)`);
    addonSrc = path.join(rootDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  }
  fs.copyFileSync(addonSrc, path.join(stagingDir, 'better_sqlite3.node'));
  log(`  Copied: better_sqlite3.node`);

  // 5. Copy resources (WASM, v.v.)
  const resourcesDest = path.join(stagingDir, 'resources');
  fs.mkdirSync(resourcesDest, { recursive: true });

  // WASM deepseek
  const wasmSrc = path.join(rootDir, 'src', 'provider', 'deepseek', 'sha3_wasm_bg.7b9ca65ddd.wasm');
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, path.join(resourcesDest, path.basename(wasmSrc)));
    log(`  Copied: resources/${path.basename(wasmSrc)}`);
  }

  // README.md
  const readmeSrc = path.join(rootDir, 'README.md');
  if (fs.existsSync(readmeSrc)) {
    fs.copyFileSync(readmeSrc, path.join(stagingDir, 'README.md'));
    log(`  Copied: README.md`);
  }

  // 6. Zip staging → releases/<version>/
  log(`  Zipping → ${zipFileName}`);
  zipDirectory(stagingDir, zipFilePath);

  const sizeMB = (fs.statSync(zipFilePath).size / 1024 / 1024).toFixed(1);
  log(`  ✓ ${zipFileName}  (${sizeMB} MB)`);

  // 7. Xóa staging
  fs.rmSync(stagingDir, { recursive: true, force: true });

  return { zipFileName, sizeMB };
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  try {
    // ── Prepare output dirs ──────────────────────────────────────────────────
    header(`AIWeb2API v${version} — Release Build`);
    log(`Output: releases/${version}/`);

    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(versionDir, { recursive: true });

    // ── TypeScript compile ───────────────────────────────────────────────────
    // Dùng tsup thay vì tsc: bundle toàn bộ deps vào 1 file CJS,
    // tránh lỗi ESM (kysely, open...) khi pkg load module lúc runtime.
    header('Step 1/4 — Bundle via tsup');
    run('npx tsup');

    // ── Copy WASM into dist ──────────────────────────────────────────────────
    header('Step 2/4 — Copy WASM files');
    copyWasmFiles(path.join(rootDir, 'src'), distDir);

    // ── Obfuscate ────────────────────────────────────────────────────────────
    header('Step 3/4 — Obfuscate');
    try {
      run('npm run obfuscate');
    } catch {
      log('  Obfuscation failed — skipping.');
    }

    // ── Build each target ────────────────────────────────────────────────────
    header('Step 4/4 — Package targets');
    const results = [];
    for (const target of BUILD_TARGETS) {
      results.push(buildTarget(target));
    }

    // ── Restore host native addon ────────────────────────────────────────────
    const hostAddon = path.join(
      rootDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node',
    );
    if (!fs.existsSync(hostAddon)) {
      log('\nRestoring host better-sqlite3...');
      run('npm rebuild better-sqlite3');
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    log(`\n${'═'.repeat(60)}`);
    log(`  Release build complete — v${version}`);
    log(`${'═'.repeat(60)}`);
    log(`\n  releases/${version}/`);
    for (const r of results) {
      log(`    ${r.zipFileName.padEnd(45)} ${r.sizeMB} MB`);
    }
    log('');
    log('  Mỗi ZIP chứa:');
    log('    RUNME.exe / RUNME     ← chạy trực tiếp, không cần cài Node');
    log('    better_sqlite3.node   ← native addon, bắt buộc');
    log('    resources/            ← WASM và file phụ trợ');
    log('');

  } catch (err) {
    console.error('\n✗ Build failed:', err.message || err);
    process.exit(1);
  }
})();
