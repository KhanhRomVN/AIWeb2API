export class ProviderHttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ProviderHttpError';
    this.statusCode = statusCode;
  }
}

export class ProviderAuthError extends ProviderHttpError {
  readonly isAuthError = true as const;

  constructor(message: string, statusCode: number) {
    super(message, statusCode);
    this.name = 'ProviderAuthError';
  }
}