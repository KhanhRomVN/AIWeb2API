import { Request, Response, NextFunction } from 'express';
import { ChatRequest } from '../types';
import { providers as bundledProviders } from '../provider/provider-config';

const fetchProviders = async () => {
  return bundledProviders || [];
};

export const validateChatRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const body = req.body as ChatRequest;
  const { modelId, search } = body;

  // Account/Provider resolution is tricky here because it usually happens inside the controller strategies.
  // However, we can try to infer provider from model or query params like the controller does,
  // OR we can move this validation INSIDE the controller after account resolution.
  // Given the complexity of account resolution (4 strategies), it is safer to perform validation
  // *inside* the controller or as a distinct step *after* determining the account.

  // But strictly speaking, if we want to validate *request structure* (types), we can do it here.
  // If we want to validate *permissions* (search allowed?), we need the provider.

  // Let's implement a "pre-validation" for structure, and a helper function for permission validation
  // that can be called inside the controller.

  // For now, let's just export the helper.
  next();
};

export const validateProviderCapabilities = async (
  providerId: string,
  features: { search?: boolean },
) => {
  const providers = await fetchProviders();
  const providerConfig = providers.find(
    (p: any) => p.provider_id.toLowerCase() === providerId.toLowerCase(),
  );

  if (!providerConfig) return null; // Provider detection failed or config missing?

  if (features.search && providerConfig.is_search === false) {
    return `Provider '${providerConfig.provider_name}' does not support search.`;
  }

  return null; // OK
};
