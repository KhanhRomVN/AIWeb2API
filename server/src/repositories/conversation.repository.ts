import { getDb } from '../database';

export interface ConversationRow {
  id: string;
  provider_id: string;
  account_id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export const findConversationById = (id: string): ConversationRow | null => {
  const db = getDb();
  return (
    (db
      .prepare('SELECT * FROM local_conversations WHERE id = ?')
      .get(id) as ConversationRow) ?? null
  );
};

export const insertConversation = (conv: ConversationRow): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO local_conversations (id, provider_id, account_id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    conv.id,
    conv.provider_id,
    conv.account_id,
    conv.title,
    conv.created_at,
    conv.updated_at,
  );
};

export const updateConversationTitle = (
  id: string,
  title: string,
  updatedAt: number,
): void => {
  const db = getDb();
  db.prepare(
    'UPDATE local_conversations SET title = ?, updated_at = ? WHERE id = ?',
  ).run(title, updatedAt, id);
};

export const deleteConversation = (id: string): void => {
  const db = getDb();
  db.prepare('DELETE FROM local_conversations WHERE id = ?').run(id);
};
