import { getDb } from '../database';

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  timestamp: number;
}

export const findMessagesByConversation = (
  conversationId: string,
): MessageRow[] => {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM local_messages WHERE conversation_id = ? ORDER BY timestamp ASC',
    )
    .all(conversationId) as MessageRow[];
};

export const insertMessage = (msg: MessageRow): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO local_messages (id, conversation_id, role, content, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(msg.id, msg.conversation_id, msg.role, msg.content, msg.timestamp);
};

export const deleteMessagesByConversation = (
  conversationId: string,
): void => {
  const db = getDb();
  db.prepare(
    'DELETE FROM local_messages WHERE conversation_id = ?',
  ).run(conversationId);
};
