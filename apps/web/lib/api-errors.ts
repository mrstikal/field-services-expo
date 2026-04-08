export function logApiError(scope: string, error: unknown) {
  console.error(`[api:${scope}]`, error);
}

export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
