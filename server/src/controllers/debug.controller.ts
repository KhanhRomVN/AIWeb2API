import { Request, Response } from 'express';
import { providerRegistry } from '../provider/registry';
import { Provider } from '../types';

// GET /v1/debug/providers
export const getDebugProviders = (req: Request, res: Response): void => {
  const providers = providerRegistry.getAllProviders();
  res.json({
    count: providers.length,
    providers: providers.map((p: Provider) => ({
      name: p.name,
      hasHandleMessage: typeof p.handleMessage === 'function',
    })),
  });
};
