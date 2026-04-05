/**
 * Color constants for the mobile app
 * Centralized color definitions to avoid color literals in styles
 */

export const colors = {
  // Grays
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#1f2937',
  gray800: '#1e293b',
  gray900: '#111827',

  // Whites
  white: '#ffffff',
  offWhite: '#f5f5f5',

  // Blues
  blue50: '#eff6ff',
  blue600: '#1e40af',
  blue700: '#1d3a8a',

  // Greens
  green500: '#22c55e',
  green600: '#059669',

  // Reds
  red50: '#fef2f2',
  red100: '#fee2e2',
  red400: '#f87171',
  red500: '#ef4444',

  // Oranges
  orange500: '#f97316',

  // Slate
  slate50: '#f8fafc',
  slate100: '#e2e8f0',
  slate800: '#1e293b',
  slate600: '#64748b',

  // Semantic colors
  background: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f97316',
  info: '#1e40af',
} as const;
