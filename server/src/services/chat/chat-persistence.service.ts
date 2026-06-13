/**
 * Chat Persistence Service
 * Handles saving conversations and messages to the local SQLite database.
 */
import { getDb } from '../../database';
import { createLogger } from '../../utils/logger';
import crypto from 'crypto';

const logger = createLogger('ChatPersistenceService');

/**
 * Saves a single message (user or assistant) to the local DB,
 * creating the parent conversation record if it doesn't exist yet.
 */
export function saveMessage(
  conversationId: string,
  providerId: string,
  accountId: string,
  messages: any[],
  role: string,
  content: string,
): void {
  if (!conversationId) return;

  const db = getDb();
  const timestamp = Date.now();

  try {
    db.prepare(
      `INSERT OR IGNORE INTO local_conversations (id, provider_id, account_id, title, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      conversationId,
      providerId,
      accountId || 'anonymous',
      messages[messages.length - 1]?.content.substring(0, 50) || 'New Chat',
      timestamp,
      timestamp,
    );

    db.prepare(
      `INSERT INTO local_messages (id, conversation_id, role, content, timestamp) 
       VALUES (?, ?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), conversationId, role, content, timestamp);

    db.prepare(
      'UPDATE local_conversations SET updated_at = ? WHERE id = ?',
    ).run(timestamp, conversationId);
  } catch (e) {
    logger.error(`Failed to save ${role} message`, e);
  }
}

/**
 * Migrates all messages from an old (temp) conversation ID to the real provider-assigned ID.
 */
export function migrateConversationId(
  oldId: string,
  newId: string,
): void {
  if (!oldId || oldId === newId) return;

  const db = getDb();
  try {
    db.transaction(() => {
      const oldConv = db
        .prepare('SELECT * FROM local_conversations WHERE id = ?')
        .get(oldId) as any;

      if (oldConv) {
        db.prepare(
          `INSERT OR IGNORE INTO local_conversations (id, provider_id, account_id, title, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          newId,
          oldConv.provider_id,
          oldConv.account_id,
          oldConv.title,
          oldConv.created_at,
          oldConv.updated_at,
        );
      }

      db.prepare(
        'UPDATE local_messages SET conversation_id = ? WHERE conversation_id = ?',
      ).run(newId, oldId);

      db.prepare('DELETE FROM local_conversations WHERE id = ?').run(oldId);
    })();
  } catch (e) {
    logger.warn('Failed to migrate conversation ID', e);
  }
}
