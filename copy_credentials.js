const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const zenmuxDbPath = path.join(os.homedir(), '.zenmux', 'database.sqlite');
const elaraDbPath = path.join(os.homedir(), '.elara', 'database.sqlite');

console.log('Source Database (ZenMux):', zenmuxDbPath);
console.log('Target Database (Elara):', elaraDbPath);

if (!fs.existsSync(zenmuxDbPath)) {
  console.error('Error: Source ZenMux database does not exist at', zenmuxDbPath);
  process.exit(1);
}

if (!fs.existsSync(elaraDbPath)) {
  console.error('Error: Target Elara database does not exist at', elaraDbPath);
  console.log('Please start the AIWeb2API server first to initialize the database.');
  process.exit(1);
}

try {
  const sourceDb = new Database(zenmuxDbPath, { readonly: true });
  const targetDb = new Database(elaraDbPath);

  // 1. Fetch provider details to make sure they exist
  const sourceProviders = sourceDb.prepare("SELECT * FROM providers").all();
  console.log(`Found ${sourceProviders.length} providers in source DB.`);
  
  // Insert missing providers into target DB
  const insertProvider = targetDb.prepare(`
    INSERT OR IGNORE INTO providers (id, title, platform, connection_type, is_enabled, website_url, auth_method, is_pausable, is_memory)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of sourceProviders) {
    insertProvider.run(
      p.id,
      p.name || p.id, // maps to title
      'web',          // platform
      'https',        // connection_type
      p.is_enabled,
      p.website_url,
      p.auth_method,
      p.is_pausable,
      p.is_memory
    );
  }
  console.log('Checked and synced providers.');

  // 2. Fetch accounts matching glm52 and moonshotai
  const sourceAccounts = sourceDb.prepare("SELECT * FROM accounts WHERE provider_id IN ('glm52', 'moonshotai')").all();
  console.log(`Found ${sourceAccounts.length} MoonshotAI/GLM-5.2 accounts in source DB.`);

  const insertAccount = targetDb.prepare(`
    INSERT OR REPLACE INTO accounts (id, provider_id, email, credential, last_refreshed_at, usage, reset_period, is_memory_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const a of sourceAccounts) {
    insertAccount.run(
      a.id,
      a.provider_id,
      a.email,
      a.credential,
      a.last_refreshed_at,
      a.usage,
      a.reset_period,
      a.is_memory_enabled
    );
    count++;
    console.log(`Copied account: ${a.email} (${a.provider_id})`);
  }

  console.log(`\nSuccessfully copied ${count} accounts to Elara database!`);
  
  sourceDb.close();
  targetDb.close();
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}
