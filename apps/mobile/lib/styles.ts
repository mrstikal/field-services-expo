/**
 * Style constants for the mobile app
 * Centralized style definitions to avoid inline styles in JSX
 */

import { ViewStyle, TextStyle } from 'react-native';

// Common padding styles
export const paddingStyles = {
  contentContainer: {
    padding: 16,
  } as ViewStyle,
};

// Card styles
export const cardStyles = {
  taskCard: {
    backgroundColor: '#ffffff',
    borderLeftColor: '#1e40af',
    borderLeftWidth: 4,
    borderRadius: 8,
    flexDirection: 'row' as const,
    marginBottom: 12,
    overflow: 'hidden' as const,
  } as ViewStyle,
};

// Modal styles
export const modalStyles = {
  signaturePad: {
    backgroundColor: '#ffffff',
    flex: 1,
  } as ViewStyle,
  bottomSheetBackground: {
    backgroundColor: '#ffffff',
  } as ViewStyle,
};

// Text input styles
export const textInputStyles = {
  base: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
  } as TextStyle,
};

// View styles
export const viewStyles = {
  flex1: {
    flex: 1,
  } as ViewStyle,
  margin8: {
    margin: 8,
  } as ViewStyle,
  overflowHidden: {
    overflow: 'hidden',
  } as ViewStyle,
};

// Button styles
export const buttonStyles = {
  base: {
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
  } as ViewStyle,
};
