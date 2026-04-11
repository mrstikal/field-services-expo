import { vi } from 'vitest';

// Expo runtime flags expected by some modules in tests
if (!('__DEV__' in globalThis)) {
  Object.defineProperty(globalThis, '__DEV__', {
    value: false,
    writable: true,
    configurable: true,
  });
}

// Test-safe defaults for modules reading env at import time
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.EXPO_PUBLIC_API_URL ??= 'http://localhost:3000';

// Mock React Native modules
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj: Record<string, unknown>) => obj.ios || obj.default,
  },
  StyleSheet: {
    create: (styles: unknown) => styles,
    flatten: (style: unknown) => style,
  },
  Animated: {
    View: 'View',
    Value: vi.fn(() => ({
      interpolate: vi.fn(),
      setValue: vi.fn(),
    })),
    sequence: vi.fn(() => ({})),
    loop: vi.fn(() => ({
      start: vi.fn(),
    })),
    timing: vi.fn(() => ({
      start: vi.fn(),
    })),
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  TouchableHighlight: 'TouchableHighlight',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  ActivityIndicator: 'ActivityIndicator',
  Alert: {
    alert: vi.fn(),
  },
  Dimensions: {
    get: vi.fn().mockReturnValue({ width: 375, height: 812 }),
    set: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
}));

vi.mock('expo-secure-store', () => {
  const store = new Map<string, string>();

  return {
    getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// Mock crypto.randomUUID for testing
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = (() => {
    let count = 0;
    return () =>
      `00000000-0000-0000-0000-${(count++).toString().padStart(12, '0')}`;
  })();
}

// Mock console methods to reduce noise in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});
