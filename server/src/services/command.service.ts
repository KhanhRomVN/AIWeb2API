import { getDb } from './db';
import { createLogger } from '../utils/logger';
import crypto from 'crypto';

const logger = createLogger('CommandService');

export type CommandType = 'ai-completion' | 'shell';

export interface Command {
  id: string;
  trigger: string;
  name: string;
  description: string;
  type: CommandType;
  action: string;
}

export class CommandService {
  async getAll(): Promise<Command[]> {
    const db = getDb();
    try {
      const rows = db
        .prepare('SELECT * FROM commands ORDER BY updated_at DESC')
        .all() as any[];
      return rows.map((row) => ({
        id: row.id,
        trigger: row.trigger,
        name: row.name,
        description: row.description,
        type: row.type as CommandType,
        action: row.action,
      }));
    } catch (err) {
      logger.error('Failed to get commands', err);
      return [];
    }
  }

  async add(command: Omit<Command, 'id'> & { id?: string }): Promise<Command> {
    const db = getDb();
    const id = command.id || crypto.randomUUID();
    const now = Date.now();
    try {
      db.prepare(
        `
        INSERT INTO commands (id, trigger, name, description, type, action, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        id,
        command.trigger,
        command.name,
        command.description,
        command.type,
        command.action,
        now,
      );
      return { ...command, id };
    } catch (err) {
      logger.error('Failed to add command', err);
      throw err;
    }
  }

  async update(id: string, updates: Partial<Command>): Promise<void> {
    const db = getDb();
    const now = Date.now();
    try {
      const fields = Object.keys(updates).filter(
        (f) => f !== 'id' && f !== 'updated_at',
      );
      if (fields.length === 0) return;

      const setClause = fields.map((f) => `${f} = ?`).join(', ');
      const values = fields.map((f) => (updates as any)[f]);

      db.prepare(
        `
        UPDATE commands 
        SET ${setClause}, updated_at = ? 
        WHERE id = ?
      `,
      ).run(...values, now, id);
    } catch (err) {
      logger.error(`Failed to update command ${id}`, err);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    const db = getDb();
    try {
      db.prepare('DELETE FROM commands WHERE id = ?').run(id);
    } catch (err) {
      logger.error(`Failed to delete command ${id}`, err);
      throw err;
    }
  }
}

export const commandService = new CommandService();
