import * as SecureStore from 'expo-secure-store';

const ACTIVE_USER_SESSION_KEY = 'active-user-session';

export interface CachedActiveUserSession {
  id: string;
  role: string;
  email?: string;
}

export async function persistActiveUserSession(
  session: CachedActiveUserSession
): Promise<void> {
  await SecureStore.setItemAsync(
    ACTIVE_USER_SESSION_KEY,
    JSON.stringify(session)
  );
}

export async function clearActiveUserSession(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_USER_SESSION_KEY);
}

export async function getCachedActiveUserSession(): Promise<CachedActiveUserSession | null> {
  const raw = await SecureStore.getItemAsync(ACTIVE_USER_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CachedActiveUserSession>;
    if (typeof parsed.id !== 'string' || parsed.id.length === 0) {
      return null;
    }

    return {
      id: parsed.id,
      role: typeof parsed.role === 'string' ? parsed.role : 'technician',
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
    };
  } catch {
    return null;
  }
}
