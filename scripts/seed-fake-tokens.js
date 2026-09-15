/**
 * ------------------------------------------------------------------
 * Script: Fake Token & Request Seeder for AIWeb2API
 * ------------------------------------------------------------------
 * Nạp dữ liệu metrics giả lập (fake tokens + requests) cho ngày hôm nay
 * với tổng số token >= 10 tỉ và số lượng request tương quan chân thực.
 *
 * Mặc định CHỈ tập trung vào các model người dùng thường dùng:
 *   1. deepseek-instant (DeepSeek)   - ~55%
 *   2. deepseek-expert  (DeepSeek)   - ~35%
 *   3. GLM-5.2          (GLM/ZenMux) - ~10%
 *
 * Cách sử dụng:
 *   node scripts/seed-fake-tokens.js
 *   node scripts/seed-fake-tokens.js --requests 250000
 *   node scripts/seed-fake-tokens.js --min 10000000000 --max 12500000000
 *   node scripts/seed-fake-tokens.js --all-models (nếu muốn nạp tất cả model)
 *   node scripts/seed-fake-tokens.js --dry-run
 * ------------------------------------------------------------------
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const Database = require('better-sqlite3');

// ─── Đọc tham số dòng lệnh ─────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(flag, defaultValue) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultValue;
}

const hasFlag = (flag) => args.includes(flag);

const isHelp = hasFlag('--help') || hasFlag('-h');

if (isHelp) {
  console.log(`
🚀 AIWeb2API - Seed Fake Tokens & Requests (GLM + 2 DeepSeek Models)

Cách sử dụng:
  node scripts/seed-fake-tokens.js [options]
  npm run seed:tokens -- [options]

Tùy chọn:
  --min <number>         Số token tối thiểu (mặc định: 10,000,000,000 = 10 tỉ)
  --max <number>         Số token tối đa (mặc định: min + 2.5 tỉ)
  --requests <number>    Chỉ định chính xác số lượng request (mặc định tự tính ~250k)
  --avg-tokens <number>  Số token trung bình / request (mặc định: 42,000)
  --all-models           Nạp phân bổ cho tất cả model trong DB thay vì chỉ GLM & DeepSeek
  --clean-all            Xóa toàn bộ metrics của ngày hôm nay (kể cả request thật)
  --all-day              Phân bổ trên cả 24h (mặc định: từ 00:00 đến giờ hiện tại)
  --date <YYYY-MM-DD>    Chỉ định ngày cụ thể (mặc định: hôm nay)
  --dry-run              Chạy thử tính toán phân bổ, không ghi vào database
  --db <path>            Đường dẫn file database SQLite tùy chọn
  --help, -h             Xem hướng dẫn này
`);
  process.exit(0);
}

// ─── Cấu hình mục tiêu ─────────────────────────────────────────────────
const minTokensParam = parseFloat(getArg('--min', '10000000000'));
const maxTokensParam = parseFloat(getArg('--max', String(minTokensParam + 2500000000)));
const avgTokensParam = parseFloat(getArg('--avg-tokens', '42000'));
const specifiedRequests = parseInt(getArg('--requests', '0'), 10);
const targetDateParam = getArg('--date', null);
const isAllDay = hasFlag('--all-day');
const shouldCleanAll = hasFlag('--clean-all');
const useAllModels = hasFlag('--all-models');
const isDryRun = hasFlag('--dry-run');
const customDbPath = getArg('--db', null);

// ─── Kết nối Database ──────────────────────────────────────────────────
const dbPath = customDbPath || path.join(os.homedir(), '.elara', 'database.sqlite');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Không tìm thấy database tại: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

// ─── Xác định khung giờ ngày ───────────────────────────────────────────
let now = new Date();
if (targetDateParam) {
  const parts = targetDateParam.split('-');
  if (parts.length === 3) {
    now = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59);
  }
}

const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
const dateStr = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`;

const maxTimeLimit = isAllDay || targetDateParam ? dayEnd.getTime() : Math.min(Date.now(), dayEnd.getTime());
const minTimeLimit = dayStart.getTime();

// ─── Cấu hình danh sách Model mục tiêu (GLM + 2 DeepSeek) ─────────────
// Chỉ dùng: deepseek-instant, deepseek-expert, và GLM-5.2
let activeModels = [];

if (useAllModels) {
  const dbModels = db.prepare('SELECT model_id, provider_id FROM models').all();
  activeModels = dbModels.map((m) => ({
    modelId: m.model_id,
    providerId: m.provider_id,
    weight: 1.0,
  }));
} else {
  activeModels = [
    {
      modelId: 'deepseek-instant',
      providerId: 'deepseek',
      weight: 0.55, // 55% traffic
    },
    {
      modelId: 'deepseek-expert',
      providerId: 'deepseek',
      weight: 0.35, // 35% traffic
    },
    {
      modelId: 'GLM-5.2',
      providerId: 'zenmux',
      weight: 0.10, // 10% traffic
    },
  ];
}

// ─── Lấy Account tương ứng ─────────────────────────────────────────────
const accounts = db.prepare('SELECT id, provider_id, email FROM accounts').all();
const deepseekAccounts = accounts.filter((a) => a.provider_id === 'deepseek');
const zenmuxAccounts = accounts.filter((a) => a.provider_id === 'zenmux' || a.provider_id === 'glm52');
const fallbackAccount = deepseekAccounts[0] || accounts[0] || { id: 'default-account' };

// Map model với danh sách accounts phù hợp
function getAccountForModel(providerId) {
  if (providerId === 'deepseek' && deepseekAccounts.length > 0) {
    return deepseekAccounts[Math.floor(Math.random() * deepseekAccounts.length)].id;
  }
  if (zenmuxAccounts.length > 0) {
    return zenmuxAccounts[Math.floor(Math.random() * zenmuxAccounts.length)].id;
  }
  // Mặc định dùng account deepseek hoặc fallback có sẵn
  return fallbackAccount.id;
}

// ─── Tính toán mục tiêu Tokens & Số lượng Request ──────────────────────
const targetTotalTokens = Math.floor(
  minTokensParam + Math.random() * Math.max(1, maxTokensParam - minTokensParam),
);

let totalRequests = specifiedRequests > 0
  ? specifiedRequests
  : Math.floor(targetTotalTokens / (avgTokensParam * (0.96 + Math.random() * 0.08)));

const avgTokensPerRequest = Math.round(targetTotalTokens / totalRequests);

console.log('='.repeat(74));
console.log('🚀 AIWeb2API - BỘ NẠP METRICS CHO GLM & 2 MODEL DEEPSEEK');
console.log('='.repeat(74));
console.log(`📁 Cơ sở dữ liệu   : ${dbPath}`);
console.log(`📅 Ngày áp dụng    : ${dateStr} (${dayStart.toLocaleDateString('vi-VN')})`);
console.log(`🎯 Mục tiêu token  : ${targetTotalTokens.toLocaleString()} tokens (~${(targetTotalTokens / 1e9).toFixed(3)} tỉ tokens)`);
console.log(`📊 Số lượng request: ${totalRequests.toLocaleString()} requests 🔥`);
console.log(`⚡ Trung bình/req  : ~${avgTokensPerRequest.toLocaleString()} tokens/request`);
console.log(`⏱️ Khung giờ       : ${new Date(minTimeLimit).toLocaleTimeString('vi-VN')} -> ${new Date(maxTimeLimit).toLocaleTimeString('vi-VN')}`);
console.log('🤖 Danh sách Models được nạp:');
activeModels.forEach((m) => {
  console.log(`   • ${m.modelId.padEnd(20)} [Provider: ${m.providerId.padEnd(10)}] (~${Math.round(m.weight * 100)}%)`);
});
console.log('='.repeat(74));

// ─── Phân tầng mô hình tiêu thụ token thực tế (Real-world Tier Model) ──
const countTier1 = Math.floor(totalRequests * 0.55); // Short chat / QA: 1k - 18k
const countTier2 = Math.floor(totalRequests * 0.35); // Multi-turn / RAG: 25k - 80k
const countTier3 = totalRequests - countTier1 - countTier2; // Long context: 120k - 350k

const weights = new Float32Array(totalRequests);
let totalWeight = 0;

for (let i = 0; i < totalRequests; i++) {
  let w;
  if (i < countTier1) {
    w = 1000 + Math.random() * 17000;
  } else if (i < countTier1 + countTier2) {
    w = 25000 + Math.random() * 55000;
  } else {
    w = 120000 + Math.random() * 230000;
  }
  weights[i] = w;
  totalWeight += w;
}

// ─── Chuẩn bị records ──────────────────────────────────────────────────
console.log('\n⏳ Đang phân bổ token ngẫu nhiên và sắp xếp theo mốc thời gian...');
const timeRange = maxTimeLimit - minTimeLimit;

// Chuẩn bị mảng phân phối model theo trọng số
const modelCumulative = [];
let cumulative = 0;
const totalModelWeight = activeModels.reduce((s, m) => s + m.weight, 0);
for (const m of activeModels) {
  cumulative += m.weight / totalModelWeight;
  modelCumulative.push({ ...m, cumulative });
}

function pickModel() {
  const r = Math.random();
  for (const m of modelCumulative) {
    if (r <= m.cumulative) return m;
  }
  return modelCumulative[modelCumulative.length - 1];
}

let runningTokensSum = 0;
const records = [];

for (let i = 0; i < totalRequests; i++) {
  let tokens = Math.round((weights[i] / totalWeight) * targetTotalTokens);
  if (tokens < 100) tokens = 100 + Math.floor(Math.random() * 900);

  const selectedModel = pickModel();
  const selectedAccountId = getAccountForModel(selectedModel.providerId);

  // Peak traffic ban ngày (09:00 - 22:00)
  let timeFactor = Math.random();
  if (Math.random() < 0.65) {
    timeFactor = 0.35 + Math.random() * 0.65;
  }
  const timestamp = Math.floor(minTimeLimit + timeFactor * timeRange);

  // 99.4% success, 0.6% error
  const isError = Math.random() < 0.006;
  const status = isError ? 'error' : 'success';
  const finalTokens = isError ? 0 : tokens;

  records.push({
    p: selectedModel.providerId,
    m: selectedModel.modelId,
    a: selectedAccountId,
    s: status,
    t: finalTokens,
    ts: timestamp,
  });

  runningTokensSum += finalTokens;
}

// Bù phần chênh lệch nhỏ vào request cuối
const tokenDiff = targetTotalTokens - runningTokensSum;
if (tokenDiff !== 0 && records.length > 0) {
  records[records.length - 1].t += tokenDiff;
}

if (isDryRun) {
  console.log('\n⚠️ Chế độ --dry-run: Không có dữ liệu nào được ghi vào database.');
  db.close();
  process.exit(0);
}

// ─── Ghi vào Database SQLite theo Transaction Cực Nhanh ────────────────
console.log(`\n💾 Đang ghi ${records.length.toLocaleString()} bản ghi vào SQLite...`);
const startTime = Date.now();

// Dọn dẹp dữ liệu fake cũ trong ngày hôm nay (giữ lại các bản ghi thật id <= 7657)
if (shouldCleanAll) {
  const del = db.prepare('DELETE FROM metrics WHERE timestamp >= ? AND timestamp <= ?').run(dayStart.getTime(), dayEnd.getTime());
  console.log(`   🧹 [Clean All] Đã xóa ${del.changes.toLocaleString()} bản ghi metrics hôm nay.`);
} else {
  // Xóa toàn bộ các bản ghi fake đã sinh ở các lần chạy trước (id > 7657 trong hôm nay)
  const del = db.prepare('DELETE FROM metrics WHERE id > 7657 AND timestamp >= ? AND timestamp <= ?').run(dayStart.getTime(), dayEnd.getTime());
  if (del.changes > 0) {
    console.log(`   🧹 [Clean Fake] Đã dọn sạch ${del.changes.toLocaleString()} bản ghi fake của các lần chạy trước.`);
  }
}

const insertStmt = db.prepare(`
  INSERT INTO metrics (provider_id, model_id, account_id, status, total_tokens, timestamp)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const batchInsertTx = db.transaction((items) => {
  for (let i = 0; i < items.length; i++) {
    const r = items[i];
    insertStmt.run(r.p, r.m, r.a, r.s, r.t, r.ts);
  }
});

batchInsertTx(records);
const elapsed = Date.now() - startTime;
console.log(`✅ Ghi thành công ${records.length.toLocaleString()} requests trong ${elapsed}ms! (${Math.round(records.length / (elapsed / 1000)).toLocaleString()} req/sec)`);

// ─── Kiểm tra lại dữ liệu thực tế từ Database ──────────────────────────
const verify = db.prepare(`
  SELECT
    COUNT(*) as total_requests,
    SUM(total_tokens) as total_tokens,
    ROUND(AVG(total_tokens), 0) as avg_tokens,
    MIN(timestamp) as min_time,
    MAX(timestamp) as max_time
  FROM metrics
  WHERE timestamp >= ? AND timestamp <= ?
`).get(dayStart.getTime(), dayEnd.getTime());

// Thống kê phân bổ Model thực tế trong DB hôm nay
const modelStats = db.prepare(`
  SELECT
    model_id,
    provider_id,
    COUNT(id) as total_requests,
    SUM(total_tokens) as total_tokens,
    ROUND(SUM(total_tokens) * 100.0 / ?, 1) as token_percent
  FROM metrics
  WHERE timestamp >= ? AND timestamp <= ?
  GROUP BY model_id, provider_id
  ORDER BY total_tokens DESC
`).all(verify.total_tokens, dayStart.getTime(), dayEnd.getTime());

console.log('\n' + '='.repeat(74));
console.log('🎉 AI MODEL DISTRIBUTION HÔM NAY (ĐÃ CẬP NHẬT CHUẨN XÁC):');
console.log('='.repeat(74));
modelStats.forEach((st) => {
  const reqStr = `${st.total_requests.toLocaleString()} reqs`.padEnd(16);
  const tokStr = `${st.total_tokens.toLocaleString()} tokens`.padStart(20);
  const pctStr = `${st.token_percent}%`.padStart(7);
  console.log(`• ${st.model_id.padEnd(20)} [${st.provider_id.padEnd(8)}]: ${reqStr} | ${tokStr} (${pctStr})`);
});

console.log('='.repeat(74));
console.log('📈 TỔNG KẾT NGÀY HÔM NAY:');
console.log(`• Tổng số requests hôm nay   : ${verify.total_requests.toLocaleString()} requests 🔥`);
console.log(`• Tổng số tokens hôm nay     : ${verify.total_tokens.toLocaleString()} tokens (~${(verify.total_tokens / 1e9).toFixed(3)} tỉ tokens) 🚀`);
console.log(`• Mức tiêu thụ trung bình    : ~${verify.avg_tokens.toLocaleString()} tokens/request`);
console.log(`• Khung giờ hoạt động        : ${new Date(verify.min_time).toLocaleTimeString('vi-VN')} -> ${new Date(verify.max_time).toLocaleTimeString('vi-VN')}`);
console.log('='.repeat(74));

db.close();
