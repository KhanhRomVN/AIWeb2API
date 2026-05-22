import { Request, Response, NextFunction } from 'express';
import { versionService } from '../services/version.service';

export const versionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const status = versionService.getStatus();

  // 1. Inject headers
  res.setHeader('X-Elara-Version', status.currentVersion);
  if (status.isUpdateAvailable) {
    res.setHeader('X-Elara-Update-Available', 'true');
    res.setHeader('X-Elara-Latest-Version', status.latestVersion);
  }

  // 2. Intercept json responses to inject warning if update is available
  const originalJson = res.json;
  res.json = function (body: any) {
    if (
      status.isUpdateAvailable &&
      body &&
      typeof body === 'object' &&
      !Array.isArray(body)
    ) {
      // Inject without breaking structure: add a non-obtrusive metadata-like field
      body._elara_update = {
        available: true,
        current: status.currentVersion,
        latest: status.latestVersion,
        message: `A new version of Elara Server is available (${status.latestVersion}). Please update via 'npm install -g @khanhromvn/elara-server'`,
      };
    }
    return originalJson.call(this, body);
  };

  next();
};
