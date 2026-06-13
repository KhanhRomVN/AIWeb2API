import { getDb } from '../database';

export interface CommandRow {
  id: string;
  trigger: string;
  name: string;
  description?: string;
  type: string;
  action: string;
  updated_at: number;
}

export const findAllCommands = (): CommandRow[] => {
  const db = getDb();
  return db.prepare('SELECT * FROM commands ORDER BY name ASC').all() as CommandRow[];
};

export const findCommandById = (id: string): CommandRow | null => {
  const db = getDb();
  return (
    (db.prepare('SELECT * FROM commands WHERE id = ?').get(id) as CommandRow) ??
    null
  );
};

export const upsertCommand = (cmd: CommandRow): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO commands (id, trigger, name, description, type, action, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       trigger = excluded.trigger,
       name = excluded.name,
       description = excluded.description,
       type = excluded.type,
       action = excluded.action,
       updated_at = excluded.updated_at`,
  ).run(
    cmd.id,
    cmd.trigger,
    cmd.name,
    cmd.description ?? null,
    cmd.type,
    cmd.action,
    cmd.updated_at,
  );
};

export const deleteCommand = (id: string): void => {
  const db = getDb();
  db.prepare('DELETE FROM commands WHERE id = ?').run(id);
};
