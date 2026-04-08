import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '@/components/error-boundary';

// Mock sentry
vi.mock('@/lib/monitoring/sentry', () => ({
  captureException: vi.fn(),
}));

// Mock expo-haptics
vi.mock('expo-haptics', () => ({
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
  },
}));

// Mock @expo/vector-icons
vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => name,
}));

// Component that throws an error for testing
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <></>;
};

// Suppress console.error for expected error boundary output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('should render children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    // No fallback UI should be shown
    expect(() => getByText('Something went wrong')).toThrow();
  });

  it('should render fallback UI when child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeDefined();
    expect(getByText('Test error message')).toBeDefined();
  });

  it('should show Try again button by default', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Try again')).toBeDefined();
  });

  it('should reset error state when Try again is pressed', () => {
    const { getByText, queryByText } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeDefined();

    fireEvent.press(getByText('Try again'));

    // After reset, fallback UI should be gone (children re-render without throwing)
    expect(queryByText('Something went wrong')).toBeNull();
  });

  it('should call retryHandler when Try again is pressed', () => {
    const retryHandlerMock = vi.fn();
    const { getByText } = render(
      <ErrorBoundary retryHandler={retryHandlerMock}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.press(getByText('Try again'));
    expect(retryHandlerMock).toHaveBeenCalledTimes(1);
  });

  it('should call onError callback when child throws', () => {
    const onErrorMock = vi.fn();
    render(
      <ErrorBoundary onError={onErrorMock}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <></>;
    const { queryByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Default fallback UI should not be shown
    expect(queryByText('Something went wrong')).toBeNull();
  });

  it('should hide Try again button when showRetry is false', () => {
    const { queryByText } = render(
      <ErrorBoundary showRetry={false}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(queryByText('Try again')).toBeNull();
    expect(queryByText('Something went wrong')).toBeDefined();
  });
});
