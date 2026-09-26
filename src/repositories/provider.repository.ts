// Provider Repository - Table `providers` removed from schema.
// Provider metadata is read from the provider registry (src/provider/*/constants).
// This file is kept to avoid breaking existing imports. All functions are no-ops.

export interface ProviderRow {
  id: string;
  title: string;
  description?: string;
  color?: string;
  platform?: string;
  connection_type?: string;
  is_enabled?: number;
  website_url?: string;
  auth_method?: string;
  is_pausable?: number;
  is_memory?: number;
  browser_extension_folder?: string;
}

/** @deprecated providers table removed */
export const findAllProviders = async (): Promise<ProviderRow[]> => [];

/** @deprecated providers table removed */
export const findProviderById = async (
  _id: string,
): Promise<ProviderRow | null> => null;

/** @deprecated providers table removed */
export const ensureProviderExists = async (
  _id: string,
  _title: string,
): Promise<void> => {};

/** @deprecated providers table removed */
export const upsertProvider = async (
  _provider: Partial<ProviderRow> & { id: string; title: string },
): Promise<void> => {};
