import * as fs from 'fs';
import * as path from 'path';
import { Router } from 'express';
import { Provider } from '../types/index';
import { createLogger } from '../utils/logger';
import { proxyService } from '../services/proxy.service';

const logger = createLogger('ProviderRegistry');

class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  register(provider: Provider) {
    const key = provider.name.toLowerCase();
    this.providers.set(key, provider);

    if (key.includes('.')) {
      const alias = key.split('.')[0];
      if (!this.providers.has(alias)) {
        this.providers.set(alias, provider);
      }
    }

    if (provider.proxyHandler) {
      proxyService.registerHandler(provider.proxyHandler);
    }
  }

  getProvider(name: string): Provider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  getAllProviders(): Provider[] {
    return Array.from(this.providers.values());
  }

  getProviderForModel(model: string): Provider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.isModelSupported && provider.isModelSupported(model)) {
        return provider;
      }
    }
    return undefined;
  }

  async loadProviders() {
    try {
      const { default: ClaudeProvider } = require('./claude');
      const { default: HuggingChatProvider } = require('./huggingchat');
      const { default: MistralProvider } = require('./mistral');
      const { default: DeepSeekProvider } = require('./deepseek');
      const { default: GroqProvider } = require('./groq');
      const { default: QwenProvider } = require('./qwen');
      const { default: QwenCliProvider } = require('./qwen-cli');
      const { default: GeminiCliProvider } = require('./gemini-cli');
      
      const { default: CodexCliProvider } = require('./codex-cli');
      const { default: ZAIProvider } = require('./zai');
      const { default: ZaiBrowserProvider } = require('./zai-browser');
      const { default: CerebrasCloudProvider } = require('./cerebras-cloud');
      const { default: GeminiProvider } = require('./gemini');

      const providers = [
        ClaudeProvider, HuggingChatProvider, MistralProvider, DeepSeekProvider,
        GroqProvider, QwenProvider, QwenCliProvider, GeminiCliProvider,
        CodexCliProvider, ZAIProvider, ZaiBrowserProvider, CerebrasCloudProvider,
        GeminiProvider,
      ];
      for (const p of providers) {
        if (p && p.name) this.register(p);
      }
      logger.info(`Registered ${this.providers.size} providers`);
    } catch (error) {
      logger.error('Failed to load providers', error);
    }
  }

  registerAllRoutes(router: Router) {
    this.providers.forEach((provider) => {
      if (provider.registerRoutes) {
        const providerRouter = Router();
        provider.registerRoutes(providerRouter);
        router.use(`/${provider.name.toLowerCase()}`, providerRouter);
      }
    });
  }
}

export const providerRegistry = new ProviderRegistry();
