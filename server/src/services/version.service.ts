import { createLogger } from '../utils/logger';

const logger = createLogger('VersionService');

class VersionService {
  private currentVersion: string = 'dev';

  constructor() {
    // Version checking disabled
  }

  public async startChecking() {
  }

  public stopChecking() {
    // No-op
  }

  public getStatus() {
    return {
      currentVersion: this.currentVersion,
      latestVersion: this.currentVersion,
      isUpdateAvailable: false,
    };
  }
}

export const versionService = new VersionService();