import type { ExpoRequest, ExpoResponse } from 'expo-router/server';

interface HealthPayload {
  status: 'ok';
  service: 'field-service-mobile-api';
  env: string;
}

export function GET(request: ExpoRequest): ExpoResponse {
  void request;
  const payload: HealthPayload = {
    status: 'ok',
    service: 'field-service-mobile-api',
    env: process.env.EXPO_PUBLIC_ENV || 'development',
  };

  return Response.json(payload) as ExpoResponse;
}
