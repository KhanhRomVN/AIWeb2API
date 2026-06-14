-- Migration: Add browser_sessions table for browser-based providers
-- Created: 2026-06-14

CREATE TABLE IF NOT EXISTS browser_sessions (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    email TEXT,
    credential TEXT NOT NULL,
    user_data_dir TEXT,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    is_active INTEGER DEFAULT 1,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_provider ON browser_sessions(provider_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_active ON browser_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_provider_active ON browser_sessions(provider_id, is_active);