'use client';

import { ReactNode, Component, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
          <div className="mb-6 rounded-full bg-red-100 p-6">
            <svg className="h-16 w-16 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Something went wrong</h1>
          <p className="mb-6 text-center text-gray-600">
            We apologize, but an unexpected error occurred.
          </p>
          {this.state.error?.message && (
            <div className="mb-8 w-full max-w-md rounded-lg bg-red-50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                Error details
              </p>
              <p className="font-mono text-sm text-red-700">{this.state.error.message}</p>
            </div>
          )}
          <div className="flex gap-4">
            <button
              onClick={this.handleReset}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Back to home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error boundary for map components
export class MapErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Map error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <svg className="h-12 w-12 text-yellow-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h3 className="text-lg font-semibold text-yellow-900">Map is temporarily unavailable</h3>
          <p className="mt-2 text-sm text-yellow-700">
            Could not load map data. Please try again later.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <p className="mt-2 text-xs text-yellow-600 italic">
              (Dev mode issue - map functionality unavailable)
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Error boundary for form components
export class FormErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Form error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg bg-red-50 p-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-red-800">Form error</h3>
              <p className="text-sm text-red-600">
                {this.state.error?.message || 'An error occurred while processing your request.'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error boundary for table components
export class TableErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Table error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center bg-gray-50 p-8 rounded-lg">
          <svg className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">Data loading error</h3>
          <p className="mt-2 text-sm text-gray-600">
            Could not load table data. Please try refreshing the page.
          </p>
          {this.state.error?.message && (
            <p className="mt-2 text-xs text-gray-500 font-mono">{this.state.error.message}</p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;