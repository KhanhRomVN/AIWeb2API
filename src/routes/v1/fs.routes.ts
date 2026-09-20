import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

/**
 * GET /v1/fs/list?path=/some/dir
 * List directories (and optionally files) at the given path.
 * Returns entries sorted: dirs first, then files, both alphabetically.
 */
router.get('/list', (req: Request, res: Response) => {
  const requestedPath = (req.query.path as string) || os.homedir();

  // Normalize and resolve to absolute path
  let targetPath: string;
  try {
    targetPath = path.resolve(requestedPath);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid path' });
  }

  // Read directory entries
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(targetPath, { withFileTypes: true });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: err.code === 'EACCES' ? 'Permission denied' : err.message,
      path: targetPath,
      parent: path.dirname(targetPath),
      entries: [],
    });
  }

  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return res.json({
    success: true,
    path: targetPath,
    parent: targetPath !== path.parse(targetPath).root
      ? path.dirname(targetPath)
      : null,
    entries: dirs.map((name) => ({
      name,
      path: path.join(targetPath, name),
    })),
  });
});

export default router;
