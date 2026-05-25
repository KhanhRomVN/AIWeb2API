import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const killPort = async (port: number): Promise<void> => {
  try {
    const { stdout } = await execAsync(`lsof -t -i:${port}`);
    if (stdout) {
      const pids = stdout.trim().split('\n');
      for (const pid of pids) {
        if (pid) {
          try {
            process.kill(parseInt(pid), 'SIGKILL');
          } catch (e) {}
        }
      }
    }
  } catch (error: any) {
    // lsof returns exit code 1 when no process found — ignore
  }
};
