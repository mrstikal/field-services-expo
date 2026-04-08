'use client';

import { ReactNode, Component, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  height?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MapViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
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
        <div
          className="relative flex flex-col items-center justify-center bg-yellow-50 border border-yellow-200 rounded-lg"
          style={{ height: this.props.height || '400px' }}
        >
          <div className="text-center px-4">
            <div className="text-yellow-800 mb-2">
              <svg
                className="w-12 h-12 mx-auto"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="font-semibold text-yellow-900">
              Map is temporarily unavailable
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Try refreshing the page
            </p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-yellow-600 mt-2 italic">
                (Dev mode issue - map functionality unavailable)
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
