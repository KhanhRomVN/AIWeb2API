/**
 * ------------------------------------------------------------------
 * Provider Registry
 * ------------------------------------------------------------------
 * Quản lý đăng ký và truy xuất các provider instances.
 * Hỗ trợ alias cho các provider, đăng ký proxy handlers,
 * và tự động load providers từ các module con.
 *
 * Main functions:
 * - register()            : Đăng ký một provider và các alias
 * - getProvider()         : Lấy provider theo tên
 * - getAllProviders()     : Lấy danh sách tất cả provider
 * - loadProviders()       : Load tất cả provider từ các module
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import * as fs from 'fs';
import * as path from 'path';

// ── Types ──
import { Provider } from '../types/index';

// ── Services ──
import { proxyService } from '../services/proxy.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('ProviderRegistry');

// ─── Class ──────────────────────────────────────────────────────────────

class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  // ─── Register ──────────────────────────────────────────────────────
  register(provider: Provider) {
    const key = provider.name.toLowerCase();
    this.providers.set(key, provider);

    // Create aliases for common variations
    const aliases: string[] = [];

    if (key.includes('.')) {
      aliases.push(key.split('.')[0]);
    }

    // General: remove dots, spaces, replace with dash
    const normalized = key.replace(/[.\s]/g, '-');
    if (normalized !== key) {
      aliases.push(normalized);
    }

    for (const alias of aliases) {
      if (!this.providers.has(alias)) {
        this.providers.set(alias, provider);
      }
    }

    if (provider.proxyHandler) {
      proxyService.registerHandler(provider.proxyHandler);
    }
  }

  // ─── Getters ────────────────────────────────────────────────────────
  getProvider(name: string): Provider | undefined {
    const key = name.toLowerCase();
    const provider = this.providers.get(key);
    return provider;
  }

  getAllProviders(): Provider[] {
    const unique = new Map<string, Provider>();
    for (const provider of this.providers.values()) {
      if (provider && provider.name) {
        const key = provider.name.toLowerCase();
        if (!unique.has(key)) {
          unique.set(key, provider);
        }
      }
    }
    return Array.from(unique.values());
  }

  // ─── Load Providers ────────────────────────────────────────────────
  async loadProviders() {
    try {
      const providersDir = __dirname;

      // Đọc tất cả các folder trong thư mục provider
      const entries = fs.readdirSync(providersDir, { withFileTypes: true });

      const providerFolders = entries.filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith('.'),
      );

      const loadedProviders: Provider[] = [];

      for (const folder of providerFolders) {
        const folderName = folder.name;
        const indexPath = path.join(providersDir, folderName, 'index.ts');
        const indexJsPath = path.join(providersDir, folderName, 'index.js');

        // Check if index file exists (either .ts or .js)
        const hasIndex = fs.existsSync(indexPath) || fs.existsSync(indexJsPath);

        if (!hasIndex) {
          continue;
        }

        try {
          // Dynamically require the provider
          const providerModule = require(`./${folderName}`);
          const provider = providerModule.default;

          if (provider && provider.name) {
            loadedProviders.push(provider);
            logger.debug(`[Registry] Loaded provider: ${provider.name}`);
          } else {
            logger.warn(`[Registry] Invalid provider in folder: ${folderName}`);
          }
        } catch (error) {
          logger.warn(
            `[Registry] Failed to load provider from ${folderName}:`,
            error,
          );
        }
      }

      // Register all loaded providers
      for (const provider of loadedProviders) {
        this.register(provider);
      }
    } catch (error) {
      logger.error('[Registry] Failed to load providers:', error);
    }
  }
}

export const providerRegistry = new ProviderRegistry();
