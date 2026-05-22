import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createLogger } from '../../utils/logger';
import { getDb } from '../../services/db';

const router = Router();
const logger = createLogger('ClaudeCodeRoutes');
const execAsync = promisify(exec);

const getClaudeSettingsPath = () => {
  const homeDir = os.homedir();
  return path.join(homeDir, '.claude', 'settings.json');
};

const checkClaudeInstalled = async () => {
  try {
    const isWindows = os.platform() === 'win32';
    const command = isWindows ? 'where claude' : 'command -v claude';
    await execAsync(command);
    return true;
  } catch {
    return false;
  }
};

router.get('/settings', async (req: Request, res: Response) => {
  try {
    const isInstalled = await checkClaudeInstalled();
    const settingsPath = getClaudeSettingsPath();

    let settings = null;
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to read claude settings', error);
      }
    }

    const db = getDb();
    const historyRow = db
      .prepare(
        "SELECT value FROM config WHERE key = 'claudecode_base_url_history'",
      )
      .get() as { value: string } | undefined;

    let history = [];
    if (historyRow?.value) {
      try {
        history = JSON.parse(historyRow.value);
      } catch (e) {
        history = [historyRow.value];
      }
    }

    res.json({
      success: true,
      data: {
        installed: isInstalled,
        settings: settings,
        path: settingsPath,
        history: history,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching claude settings', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/settings', async (req: Request, res: Response) => {
  try {
    const { env } = req.body;
    if (!env || typeof env !== 'object') {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid env object' });
    }

    const settingsPath = getClaudeSettingsPath();
    const claudeDir = path.dirname(settingsPath);

    await fs.mkdir(claudeDir, { recursive: true });

    let currentSettings: any = {};
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      currentSettings = JSON.parse(content);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }

    // Modernize and normalize
    const newSettings = {
      ...currentSettings,
      env: {
        ...(currentSettings.env || {}),
        ...env,
      },
    };

    await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2));

    res.json({
      success: true,
      message: 'Claude settings updated successfully',
    });
  } catch (error: any) {
    logger.error('Failed to update claude settings', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/settings', async (req: Request, res: Response) => {
  try {
    const settingsPath = getClaudeSettingsPath();
    await fs.unlink(settingsPath);
    res.json({ success: true, message: 'Claude settings reset successfully' });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.json({
        success: true,
        message: 'Settings file already deleted',
      });
    }
    logger.error('Failed to reset claude settings', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
