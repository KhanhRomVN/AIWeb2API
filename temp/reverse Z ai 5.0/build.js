/**
 * build.js — Production Build Script (v1.0.5)
 * 
 * Strategy: javascript-obfuscator (server + extension) + pkg (.exe)
 * 
 * Flow:
 *   1. Compile TypeScript → JavaScript
 *   2. Obfuscate server .js files
 *   3. Obfuscate extension JS files
 *   4. Package into .exe via pkg (optional)
 *   5. Finalize distribution folder
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// CONFIG
// ============================================================
const DIST_DIR = path.join(__dirname, 'dist');
const DIST_SERVER = path.join(DIST_DIR, 'server');
const DIST_EXTENSION = path.join(DIST_DIR, 'extension');
const DIST_RELEASE = path.join(DIST_DIR, 'release');
const SRC_DIR = __dirname;
const EXTENSION_DIR = path.join(SRC_DIR, 'extension');

const SERVER_FILES = ['z.js', 'rate-limiter.js', 'src/server.js'];
const EXTENSION_JS_FILES = ['content.js', 'inject.js', 'popup.js', 'background.js'];
const EXTENSION_ASSET_FILES = ['manifest.json', 'rules.json', 'popup.html'];

// Obfuscator config for server files (stronger)
const SERVER_OBFUSCATOR_OPTIONS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.8,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 3,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.8,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
    target: 'node'
};

// Obfuscator config for extension files (browser-compatible)
const EXTENSION_OBFUSCATOR_OPTIONS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
    target: 'browser-no-eval'
};

// ============================================================
// HELPERS
// ============================================================
function log(step, msg) {
    console.log(`\n[${step}] ${msg}`);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    ensureDir(dir);
}

function copyFile(src, dest) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
}

function run(cmd) {
    console.log(`  > ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: SRC_DIR });
}

function runSafe(cmd) {
    console.log(`  > ${cmd}`);
    try {
        execSync(cmd, { stdio: 'pipe', cwd: SRC_DIR, timeout: 300000 });
        return true;
    } catch (e) {
        console.log(`  ⚠️ Command failed: ${e.message ? e.message.substring(0, 200) : 'Unknown error'}`);
        if (e.stderr) {
            const stderr = e.stderr.toString().substring(0, 500);
            if (stderr.trim()) console.log(`  stderr: ${stderr}`);
        }
        return false;
    }
}

function copyDirRecursive(src, dest) {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// ============================================================
// STEP 1: Clean & Compile TypeScript
// ============================================================
function step1_compile() {
    log('STEP 1', 'Cleaning dist/ and compiling TypeScript...');
    cleanDir(DIST_DIR);
    cleanDir(DIST_SERVER);
    cleanDir(DIST_EXTENSION);

    if (!runSafe('npx tsc')) {
        throw new Error('TypeScript compilation failed.');
    }

    // Verify compiled files exist
    for (const file of SERVER_FILES) {
        const fullPath = path.join(SRC_DIR, file);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Compiled file not found: ${fullPath}`);
        }
    }
    console.log('  ✅ TypeScript compiled successfully.');
}

// ============================================================
// STEP 2: Obfuscate server .js files
// ============================================================
function step2_obfuscate_server() {
    log('STEP 2', 'Obfuscating server .js files...');

    const JavaScriptObfuscator = require('javascript-obfuscator');

    // Copy toàn bộ thư mục src đã biên dịch sang dist/server/src
    const srcFolder = path.join(SRC_DIR, 'src');
    const destFolder = path.join(DIST_SERVER, 'src');
    cleanDir(destFolder);
    copyDirRecursive(srcFolder, destFolder);
    console.log('  ✅ Compiled src/ directory copied to dist/server/src/');

    for (const file of SERVER_FILES) {
        const srcPath = path.join(SRC_DIR, file);
        const destDir = path.join(DIST_SERVER, path.dirname(file));
        ensureDir(destDir);

        const destPath = path.join(DIST_SERVER, file);

        const code = fs.readFileSync(srcPath, 'utf8');
        const result = JavaScriptObfuscator.obfuscate(code, SERVER_OBFUSCATOR_OPTIONS);

        fs.writeFileSync(destPath, result.getObfuscatedCode());
        console.log(`  ✅ ${file} → obfuscated`);
    }

    // Create loader entry point
    const loaderPath = path.join(DIST_SERVER, 'loader.js');
    fs.writeFileSync(loaderPath, `require('./src/server.js');\n`);
    console.log('  ✅ Loader entry point created.');
}

// ============================================================
// STEP 3: Obfuscate extension JS files
// ============================================================
function step3_obfuscate_extension() {
    log('STEP 3', 'Obfuscating Chrome Extension files...');

    const JavaScriptObfuscator = require('javascript-obfuscator');

    for (const file of EXTENSION_JS_FILES) {
        const srcPath = path.join(EXTENSION_DIR, file);
        const destPath = path.join(DIST_EXTENSION, file);

        const code = fs.readFileSync(srcPath, 'utf8');
        const result = JavaScriptObfuscator.obfuscate(code, EXTENSION_OBFUSCATOR_OPTIONS);

        fs.writeFileSync(destPath, result.getObfuscatedCode());
        console.log(`  ✅ ${file} → obfuscated`);
    }

    // Copy non-JS assets
    for (const file of EXTENSION_ASSET_FILES) {
        const srcPath = path.join(EXTENSION_DIR, file);
        const destPath = path.join(DIST_EXTENSION, file);
        copyFile(srcPath, destPath);
        console.log(`  ✅ ${file} → copied`);
    }

    // Copy _metadata folder if exists
    const metadataDir = path.join(EXTENSION_DIR, '_metadata');
    if (fs.existsSync(metadataDir)) {
        const destMetadata = path.join(DIST_EXTENSION, '_metadata');
        try {
            copyDirRecursive(metadataDir, destMetadata);
            console.log('  ✅ _metadata/ → copied');
        } catch (e) {
            console.log(`  ⚠️ Could not copy _metadata: ${e.message}`);
        }
    }
}

// ============================================================
// STEP 4: Package into .exe (pkg) — optional
// ============================================================
function step4_pkg() {
    log('STEP 4', 'Packaging into .exe with pkg...');

    // Check if pkg is available
    const pkgCheck = runSafe('npx pkg --version');
    if (!pkgCheck) {
        console.log('  ⚠️ pkg is not available. Skipping .exe packaging.');
        console.log('  ℹ️ You can still run server with: node dist/server/loader.js');
        return false;
    }

    cleanDir(DIST_RELEASE);

    const entryPoint = path.join(DIST_SERVER, 'loader.js');
    const outputPath = path.join(DIST_RELEASE, 'z-ai-bridge.exe');

    const success = runSafe(`npx pkg "${entryPoint}" --target node18-win-x64 --output "${outputPath}" --config package.json --no-bytecode --public`);

    if (success && fs.existsSync(outputPath)) {
        console.log('  ✅ .exe created successfully.');
        return true;
    } else {
        console.log('  ⚠️ pkg failed to create .exe.');
        console.log('  ℹ️ You can still run server with: node dist/server/loader.js');
        return false;
    }
}

// ============================================================
// STEP 5: Final packaging — create distribution folder
// ============================================================
function step5_finalize(pkgSuccess) {
    log('STEP 5', 'Creating final distribution package...');

    // If pkg succeeded, add extension + README to release folder
    if (pkgSuccess) {
        const releaseExtDir = path.join(DIST_RELEASE, 'extension');
        cleanDir(releaseExtDir);
        copyDirRecursive(DIST_EXTENSION, releaseExtDir);
        console.log('  ✅ Extension copied to release/');
    }

    // Always create standalone distribution (works without .exe)
    const standaloneDir = path.join(DIST_DIR, 'standalone');
    ensureDir(standaloneDir);

    // Copy server files
    const standaloneServer = path.join(standaloneDir, 'server');
    cleanDir(standaloneServer);
    copyDirRecursive(DIST_SERVER, standaloneServer);
    console.log('  ✅ Server files → dist/standalone/server/');

    // Copy extension files
    const standaloneExt = path.join(standaloneDir, 'extension');
    cleanDir(standaloneExt);
    copyDirRecursive(DIST_EXTENSION, standaloneExt);
    console.log('  ✅ Extension files → dist/standalone/extension/');

    // Create run.bat for standalone
    const batPath = path.join(standaloneDir, 'start-server.bat');
    fs.writeFileSync(batPath, `@echo off\necho Starting Z.AI Bridge Server v1.0.5...\nnode server\\loader.js\npause\n`);
    console.log('  ✅ start-server.bat created');

    // Create README
    const readmePath = path.join(standaloneDir, 'README.txt');
    const readmeContent = `============================================
  Z.AI Bridge v1.0.5
============================================

1. Cai dat Chrome Extension:
   - Mo chrome://extensions/ -> Bat "Developer mode"
   - Click "Load unpacked" -> Chon thu muc "extension"

2. Chay Server:
   - Double-click start-server.bat
   - Hoac CMD: node server/loader.js

3. Su dung:
   - Mo Chrome, truy cap https://chat.z.ai/
   - Dang nhap Z.AI
   - Extension tu dong ket noi (indicator goc phai duoi)
   - API: http://localhost:8888

4. Endpoints:
   - POST http://localhost:8888/v1/chat/accounts/messages
   - POST http://localhost:8888/api/v2/chat/completions
   - GET  http://localhost:8888/v1/health

5. Yeu cau:
   - Can cai Node.js (v18+) de chay server
   - Can ket noi internet

============================================
`;
    fs.writeFileSync(readmePath, readmeContent);
    console.log('  ✅ README.txt created');

    // Summary
    console.log('\n============================================================');
    console.log('  BUILD COMPLETE!');
    console.log('============================================================');

    if (pkgSuccess) {
        console.log('\n  Package 1: dist/release/ (standalone .exe)');
        console.log('    |-- z-ai-bridge.exe');
        console.log('    |-- extension/');
        console.log('    +-- README.txt');
    }

    console.log('\n  Package 2: dist/standalone/ (requires Node.js)');
    console.log('    |-- start-server.bat');
    console.log('    |-- server/');
    console.log('    |   |-- loader.js');
    console.log('    |   |-- z.js          (obfuscated)');
    console.log('    |   |-- rate-limiter.js (obfuscated)');
    console.log('    |   +-- src/');
    console.log('    |       +-- server.js  (obfuscated)');
    console.log('    |-- extension/');
    console.log('    |   |-- content.js    (obfuscated)');
    console.log('    |   |-- inject.js     (obfuscated)');
    console.log('    |   +-- ...');
    console.log('    +-- README.txt');
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('============================================================');
    console.log('  Z.AI Bridge — Production Build (v1.0.5)');
    console.log('============================================================');

    try {
        step1_compile();
        step2_obfuscate_server();
        step3_obfuscate_extension();

        let pkgSuccess = false;
        try {
            pkgSuccess = step4_pkg();
        } catch (e) {
            console.log(`  ⚠️ pkg step error: ${e.message}`);
        }

        step5_finalize(pkgSuccess);

    } catch (e) {
        console.error('\n❌ BUILD FAILED:', e.message);
        process.exit(1);
    }
}

main();