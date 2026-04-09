import type { ExpoRequest, ExpoResponse } from 'expo-router/server';

interface UpdatesPayload {
  env: string;
  hasEasProjectId: boolean;
  updatesUrlConfigured: boolean;
}

export function GET(request: ExpoRequest): ExpoResponse {
  void request;

  const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const payload: UpdatesPayload = {
    env: process.env.EXPO_PUBLIC_ENV || 'development',
    hasEasProjectId: typeof easProjectId === 'string' && easProjectId.length > 0,
    updatesUrlConfigured:
      typeof easProjectId === 'string' &&
      easProjectId.length > 0 &&
      easProjectId !== 'YOUR_EAS_PROJECT_ID',
  };

  return Response.json(payload) as ExpoResponse;
}
