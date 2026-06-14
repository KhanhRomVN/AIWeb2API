import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ============================================================
// MappingService — Quản lý ánh xạ Zen conversationId ↔ Z.AI chat_id
// Tách từ server.ts (lines 35–122) để dễ test và bảo trì.
// ============================================================

export interface MappingEntry {
    zaiChatId: string;
    lastAccess: number;
}

const CONVERSATION_MAPPING_FILE = path.join(os.homedir(), 'khanhromvn-zen', 'conversation-mapping.json');

/** TTL cho conversation-mapping.json — xóa entries cũ hơn 30 ngày (Fix H07) */
const MAPPING_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Ngưỡng lazy-cleanup: chỉ dọn khi mapping vượt 200 entries */
const CLEANUP_THRESHOLD = 200;

/** In-session conversation tracker: id → lastAccessTime (ms) */
const activeServerConversations = new Map<string, number>();

/** Persistent mapping: zenId → { zaiChatId, lastAccess } */
const conversationMapping = new Map<string, MappingEntry>();

// ---- Persistence ----

function persistMapping() {
    try {
        const dir = path.dirname(CONVERSATION_MAPPING_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const obj = Object.fromEntries(conversationMapping);
        fs.writeFileSync(CONVERSATION_MAPPING_FILE, JSON.stringify(obj, null, 2));
    } catch (e) {
        console.error('[MappingService] Failed to persist conversation mapping:', e);
    }
}

function loadPersistedMapping() {
    try {
        const dir = path.dirname(CONVERSATION_MAPPING_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.existsSync(CONVERSATION_MAPPING_FILE)) {
            const data = fs.readFileSync(CONVERSATION_MAPPING_FILE, 'utf-8');
            const entries = JSON.parse(data);
            const now = Date.now();
            let loaded = 0;
            let pruned = 0;
            for (const [key, value] of Object.entries(entries)) {
                const entry = value as MappingEntry;
                // Fix H07: bỏ qua entries cũ hơn TTL khi load
                if (now - (entry.lastAccess || 0) > MAPPING_TTL_MS) {
                    pruned++;
                    continue;
                }
                conversationMapping.set(key, entry);
                loaded++;
            }
            console.log(
                `[MappingService] 🔗 Loaded ${loaded} conversation mappings from disk.` +
                (pruned > 0 ? ` Pruned ${pruned} expired entries (>30d).` : '')
            );
            if (pruned > 0) persistMapping();
        }
    } catch (e) {
        console.error('[MappingService] Failed to load conversation mapping:', e);
    }
}

// Fix H07: Lazy cleanup khi vượt ngưỡng CLEANUP_THRESHOLD
function cleanupOldMappingsIfNeeded() {
    if (conversationMapping.size < CLEANUP_THRESHOLD) return;
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of conversationMapping) {
        if (now - (entry.lastAccess || 0) > MAPPING_TTL_MS) {
            conversationMapping.delete(key);
            pruned++;
        }
    }
    if (pruned > 0) {
        console.log(`[MappingService] 🧹 Pruned ${pruned} expired mapping entries (>30d). Remaining: ${conversationMapping.size}`);
        persistMapping();
    }
}

// ---- Public API ----

export class MappingService {
    constructor() {
        loadPersistedMapping();
    }

    /** Đăng ký ánh xạ mới (hoặc cập nhật) giữa Zen ID và Z.AI chat_id */
    register(zenConversationId: string, zaiChatId: string): void {
        conversationMapping.set(zenConversationId, { zaiChatId, lastAccess: Date.now() });
        cleanupOldMappingsIfNeeded();
        persistMapping();
        console.log(`[MappingService] 🔗 Registered mapping: Zen=${zenConversationId} → Z.AI=${zaiChatId}`);
    }

    /** Lấy Z.AI chat_id từ Zen conversation ID. Trả về undefined nếu không tồn tại hoặc đã hết hạn */
    resolve(zenConversationId: string): string | undefined {
        const entry = conversationMapping.get(zenConversationId);
        if (!entry) return undefined;
        if (Date.now() - entry.lastAccess > MAPPING_TTL_MS) {
            conversationMapping.delete(zenConversationId);
            return undefined;
        }
        return entry.zaiChatId;
    }

    /** Kiểm tra xem conversation ID có tồn tại trong mapping không */
    has(zenConversationId: string): boolean {
        return conversationMapping.has(zenConversationId);
    }

    /** Cập nhật thời gian truy cập cuối (persistent mapping) */
    touchPersistent(zenConversationId: string): void {
        const existing = conversationMapping.get(zenConversationId);
        if (existing) {
            existing.lastAccess = Date.now();
            persistMapping();
        }
    }

    /** Cập nhật in-session tracking (active conversations) */
    touch(id: string): void {
        const now = Date.now();
        // Lazy cleanup: dọn in-memory khi > 100 entries, lâu > 30 phút
        if (activeServerConversations.size > 100) {
            for (const [key, lastAccess] of activeServerConversations) {
                if (now - lastAccess > 30 * 60 * 1000) {
                    activeServerConversations.delete(key);
                }
            }
        }
        activeServerConversations.set(id, now);
    }

    /** Kiểm tra xem conversation đang active trong session hiện tại không */
    isActiveInMemory(id: string): boolean {
        return activeServerConversations.has(id);
    }

    /** Số lượng mapping entries hiện tại */
    get size(): number {
        return conversationMapping.size;
    }
}
