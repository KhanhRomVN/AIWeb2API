"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MappingService = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const CONVERSATION_MAPPING_FILE = path.join(os.homedir(), 'khanhromvn-zen', 'conversation-mapping.json');
/** TTL cho conversation-mapping.json — xóa entries cũ hơn 30 ngày (Fix H07) */
const MAPPING_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Ngưỡng lazy-cleanup: chỉ dọn khi mapping vượt 200 entries */
const CLEANUP_THRESHOLD = 200;
/** In-session conversation tracker: id → lastAccessTime (ms) */
const activeServerConversations = new Map();
/** Persistent mapping: zenId → { zaiChatId, lastAccess } */
const conversationMapping = new Map();
// ---- Persistence ----
function persistMapping() {
    try {
        const dir = path.dirname(CONVERSATION_MAPPING_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const obj = Object.fromEntries(conversationMapping);
        fs.writeFileSync(CONVERSATION_MAPPING_FILE, JSON.stringify(obj, null, 2));
    }
    catch (e) {
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
                const entry = value;
                // Fix H07: bỏ qua entries cũ hơn TTL khi load
                if (now - (entry.lastAccess || 0) > MAPPING_TTL_MS) {
                    pruned++;
                    continue;
                }
                conversationMapping.set(key, entry);
                loaded++;
            }
            console.log(`[MappingService] 🔗 Loaded ${loaded} conversation mappings from disk.` +
                (pruned > 0 ? ` Pruned ${pruned} expired entries (>30d).` : ''));
            if (pruned > 0)
                persistMapping();
        }
    }
    catch (e) {
        console.error('[MappingService] Failed to load conversation mapping:', e);
    }
}
// Fix H07: Lazy cleanup khi vượt ngưỡng CLEANUP_THRESHOLD
function cleanupOldMappingsIfNeeded() {
    if (conversationMapping.size < CLEANUP_THRESHOLD)
        return;
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
class MappingService {
    constructor() {
        loadPersistedMapping();
    }
    /** Đăng ký ánh xạ mới (hoặc cập nhật) giữa Zen ID và Z.AI chat_id */
    register(zenConversationId, zaiChatId) {
        conversationMapping.set(zenConversationId, { zaiChatId, lastAccess: Date.now() });
        cleanupOldMappingsIfNeeded();
        persistMapping();
        console.log(`[MappingService] 🔗 Registered mapping: Zen=${zenConversationId} → Z.AI=${zaiChatId}`);
    }
    /** Lấy Z.AI chat_id từ Zen conversation ID. Trả về undefined nếu không tồn tại hoặc đã hết hạn */
    resolve(zenConversationId) {
        const entry = conversationMapping.get(zenConversationId);
        if (!entry)
            return undefined;
        if (Date.now() - entry.lastAccess > MAPPING_TTL_MS) {
            conversationMapping.delete(zenConversationId);
            return undefined;
        }
        return entry.zaiChatId;
    }
    /** Kiểm tra xem conversation ID có tồn tại trong mapping không */
    has(zenConversationId) {
        return conversationMapping.has(zenConversationId);
    }
    /** Cập nhật thời gian truy cập cuối (persistent mapping) */
    touchPersistent(zenConversationId) {
        const existing = conversationMapping.get(zenConversationId);
        if (existing) {
            existing.lastAccess = Date.now();
            persistMapping();
        }
    }
    /** Cập nhật in-session tracking (active conversations) */
    touch(id) {
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
    isActiveInMemory(id) {
        return activeServerConversations.has(id);
    }
    /** Số lượng mapping entries hiện tại */
    get size() {
        return conversationMapping.size;
    }
}
exports.MappingService = MappingService;
