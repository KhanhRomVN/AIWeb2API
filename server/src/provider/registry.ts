import * as fs from 'fs';
import * as path from 'path';
import { Router } from 'express';
import { Provider } from './types';
import { createLogger } from '../utils/logger';
import { proxyService } from '../services/proxy.service';
// Proxy handlers are now loaded dynamically

const logger = createLogger('ProviderRegistry');

class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  register(provider: Provider) {
    const key = provider.name.toLowerCase();
    if (this.providers.has(key)) {
      logger.warn(
        `Provider ${provider.name} is already registered. Overwriting.`,
      );
    }
    this.providers.set(key, provider);
    logger.info(`Registered provider: ${provider.name}`);

    // Register aliases for provider names with dots (e.g., "Z.AI" should also be accessible as "z")
    if (key.includes('.')) {
      const alias = key.split('.')[0];
      if (!this.providers.has(alias)) {
        this.providers.set(alias, provider);
        logger.info(`Registered alias "${alias}" for provider: ${provider.name}`);
      }
    }

    if (provider.proxyHandler) {
      proxyService.registerHandler(provider.proxyHandler);
      logger.info(`Registered proxy handler for ${provider.name}`);
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

  // Static loading of providers for bundler compatibility
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
      const { default: KiroCliProvider } = require('./kiro-cli');
      const { default: CodexCliProvider } = require('./codex-cli');
      const { default: ZAIProvider } = require('./zai');

      const providers = [
        ClaudeProvider,
        HuggingChatProvider,
        MistralProvider,
        DeepSeekProvider,
        GroqProvider,
        QwenProvider,
        QwenCliProvider,
        GeminiCliProvider,
        KiroCliProvider,
        CodexCliProvider,
        ZAIProvider,
      ];
      for (const ProviderClass of providers) {
        if (ProviderClass && ProviderClass.name) {
          this.register(ProviderClass);
        }
      }
    } catch (error) {
      logger.error('Failed to load static providers:', error);
    }
  }

  registerAllRoutes(router: Router) {
    this.providers.forEach((provider) => {
      if (provider.registerRoutes) {
        const providerRouter = Router();
        provider.registerRoutes(providerRouter);
        router.use(`/${provider.name.toLowerCase()}`, providerRouter);
        logger.info(`Mounted routes for ${provider.name}`);
      }
    });
  }
}

export const providerRegistry = new ProviderRegistry();
