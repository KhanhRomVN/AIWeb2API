import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './logger';

const logger = createLogger('kill-port');
const execAsync = promisify(exec);

/**
 * Kill process(es) using a specific port
 * Returns true if successful, false otherwise
 */
export const killProcessOnPort = async (port: number): Promise<boolean> => {
  try {
    // Try using fuser (Linux)
    try {
      const { stdout } = await execAsync(`fuser -k ${port}/tcp 2>/dev/null`);
      if (stdout) {
        logger.info(`Killed process on port ${port} using fuser`);
        return true;
      }
    } catch (e: any) {
      // fuser may return non-zero if no process found
      if (e.code === 1) {
        // No process found - that's fine, port is free
        return true;
      }
      // Other error, try alternative method
    }

    // Try using lsof + kill
    try {
      const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null`);
      if (stdout && stdout.trim()) {
        const pids = stdout.trim().split('\n');
        for (const pid of pids) {
          await execAsync(`kill -9 ${pid} 2>/dev/null`);
        }
        logger.info(`Killed ${pids.length} process(es) on port ${port} using lsof`);
        return true;
      }
      // No process found
      return true;
    } catch (e) {
      // lsof may fail if not installed or no process found
      return false;
    }
  } catch (error) {
    logger.error(`Failed to kill process on port ${port}:`, error);
    return false;
  }
};

/**
 * Check if a port is in use
 * Returns true if port is in use, false otherwise
 */
export const isPortInUse = async (port: number): Promise<boolean> => {
  try {
    // Check with fuser
    try {
      await execAsync(`fuser ${port}/tcp 2>/dev/null`);
      return true;
    } catch (e) {
      // fuser returns non-zero if no process found
    }

    // Check with lsof
    try {
      const { stdout } = await execAsync(`lsof -ti :${port} 2>/dev/null`);
      return !!(stdout && stdout.trim().length > 0);
    } catch (e) {
      return false;
    }
    return false;
  } catch (error) {
    return false;
  }
};