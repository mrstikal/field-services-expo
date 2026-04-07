import { vi } from 'vitest';

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
    Value: vi.fn(() => ({
      interpolate: vi.fn(),
      setValue: vi.fn(),
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

// Mock crypto.randomUUID for testing
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = (() => {
    let count = 0;
    return () => `00000000-0000-0000-0000-${(count++).toString().padStart(12, '0')}`;
  })();
}

// Mock console methods to reduce noise in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});