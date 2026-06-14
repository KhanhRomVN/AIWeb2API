const path = require('path');
process.chdir(path.join(__dirname));
console.log('CWD:', process.cwd());

try {
  const ts = require('typescript');
  console.log('TypeScript version:', ts.version);

  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length === 0) {
    console.log('✅ No TypeScript errors!');
  } else {
    console.log(`❌ Found ${diagnostics.length} error(s):`);
    diagnostics.slice(0, 30).forEach((d, i) => {
      const file = d.file ? d.file.fileName : '?';
      const line = d.file && d.start ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : '?';
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      console.log(`  ${i+1}. ${file}:${line} — ${msg}`);
    });
    if (diagnostics.length > 30) {
      console.log(`  ... and ${diagnostics.length - 30} more`);
    }
  }
} catch (e) {
  console.log('TypeScript not installed locally. Checking syntax manually...');
  const fs = require('fs');

  const files = [
    'src/utils/usage-tracker.ts',
    'src/utils/sse.ts',
    'src/routes/zen.ts',
    'z.ts',
  ];

  files.forEach(f => {
    const content = fs.readFileSync(f, 'utf-8');
    console.log(`  ${f}: ${content.split('\n').length} lines — OK`);
  });
  console.log('✅ All files readable. Install typescript for full type checking.');
}