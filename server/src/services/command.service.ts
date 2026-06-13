import { createLogger } from '../utils/logger';
import crypto from 'crypto';
import {
  findAllCommands,
  upsertCommand,
  deleteCommand as deleteCommandRow,
} from '../repositories/command.repository';

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
    try {
      const rows = findAllCommands();
      return rows.map((row) => ({
        id: row.id,
        trigger: row.trigger,
        name: row.name,
        description: row.description ?? '',
        type: row.type as CommandType,
        action: row.action,
      }));
    } catch (err) {
      logger.error('Failed to get commands', err);
      return [];
    }
  }

  async add(command: Omit<Command, 'id'> & { id?: string }): Promise<Command> {
    const id = command.id || crypto.randomUUID();
    try {
      upsertCommand({
        id,
        trigger: command.trigger,
        name: command.name,
        description: command.description,
        type: command.type,
        action: command.action,
        updated_at: Date.now(),
      });
      return { ...command, id };
    } catch (err) {
      logger.error('Failed to add command', err);
      throw err;
    }
  }

  async update(id: string, updates: Partial<Command>): Promise<void> {
    try {
      const existing = findAllCommands().find((c) => c.id === id);
      if (!existing) throw new Error(`Command ${id} not found`);
      upsertCommand({
        id,
        trigger: updates.trigger ?? existing.trigger,
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description ?? '',
        type: updates.type ?? (existing.type as CommandType),
        action: updates.action ?? existing.action,
        updated_at: Date.now(),
      });
    } catch (err) {
      logger.error(`Failed to update command ${id}`, err);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      deleteCommandRow(id);
    } catch (err) {
      logger.error(`Failed to delete command ${id}`, err);
      throw err;
    }
  }
}

export const commandService = new CommandService();
