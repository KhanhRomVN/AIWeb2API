const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const sources = [
  { dir: 'src-tauri/target/release/bundle/deb', ext: '.deb' },
  { dir: 'src-tauri/target/release/bundle/rpm', ext: '.rpm' },
  { dir: 'src-tauri/target/release/bundle/appimage', ext: '.AppImage' },
  { dir: 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis', ext: '.exe' },
];

console.log('--- Collecting Installers ---');

sources.forEach(({ dir, ext }) => {
  const fullDir = path.join(projectRoot, dir);
  if (fs.existsSync(fullDir)) {
    const files = fs.readdirSync(fullDir);
    files.forEach((file) => {
      if (file.endsWith(ext)) {
        const src = path.join(fullDir, file);
        const dest = path.join(distDir, file);
        console.log(`Copying: ${file} -> dist/`);
        fs.copyFileSync(src, dest);
      }
    });
  } else {
    console.log(`Directory not found: ${dir}`);
  }
});

console.log('--- Collection Complete ---');
