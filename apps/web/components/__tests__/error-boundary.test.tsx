import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ErrorBoundary,
  MapErrorBoundary,
  FormErrorBoundary,
  TableErrorBoundary,
} from '@components/error-boundary';

// Component that throws an error for testing
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Child content</div>;
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
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should show Try again button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('should reset error state when Try again is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Try again'));
    // After reset, children re-render (ThrowingComponent no longer throws after reset)
    expect(screen.queryByText('Something went wrong')).toBeNull();
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
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('should show Back to home button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Back to home')).toBeInTheDocument();
  });
});

describe('MapErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <MapErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </MapErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render map error fallback when child throws', () => {
    render(
      <MapErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </MapErrorBoundary>
    );
    expect(
      screen.getByText('Map is temporarily unavailable')
    ).toBeInTheDocument();
  });
});

describe('FormErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <FormErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </FormErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render form error fallback when child throws', () => {
    render(
      <FormErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </FormErrorBoundary>
    );
    expect(screen.getByText('Form error')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });
});

describe('TableErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <TableErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </TableErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render table error fallback when child throws', () => {
    render(
      <TableErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </TableErrorBoundary>
    );
    expect(screen.getByText('Data loading error')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });
});
