import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { getConfigValue } from '../repositories/config.repository';
import { getDb } from '../database';

const logger = createLogger('ConfigController');

// GET /v1/config/values?keys=key1,key2
export const getConfigValues = async (req: Request, res: Response): Promise<void> => {
  try {
    const keys = req.query.keys as string;
    if (!keys) {
      res.status(400).json({ success: false, message: 'Keys are required' });
      return;
    }

    const keyList = keys.split(',');
    const results: Record<string, string> = {};
    for (const key of keyList) {
      results[key] = getConfigValue(key) ?? '';
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    logger.error('Failed to get config values', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /v1/config/values
export const updateConfigValues = async (req: Request, res: Response): Promise<void> => {
  try {
    const values = req.body;
    const db = getDb();

    const upsert = db.prepare(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    );
    db.transaction(() => {
      for (const [key, value] of Object.entries(values)) {
        upsert.run(key, String(value));
      }
    })();

    res.json({ success: true, message: 'Config values updated successfully' });
  } catch (error: any) {
    logger.error('Failed to update config values', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
