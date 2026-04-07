import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly fallback?: React.ReactNode;
  readonly onError?: (error: Error) => void;
  readonly showRetry?: boolean;
  readonly retryHandler?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.retryHandler?.();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ScrollView
          className="flex-1 bg-slate-50"
          contentContainerClassName="flex-1 items-center justify-center p-6"
        >
          <View className="mb-6">
            <Ionicons color="#ef4444" name="alert-circle-outline" size={64} />
          </View>

          <Text className="mb-2 text-2xl font-bold text-gray-800">Something went wrong</Text>
          <Text className="mb-4 text-center text-base text-gray-500">
            We apologize, but an unexpected error occurred.
          </Text>

          {this.state.error?.message ? (
            <View className="mb-8 w-full rounded-lg bg-red-50 p-4">
              <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                Error details
              </Text>
              <Text className="font-mono text-xs text-red-700">{this.state.error.message}</Text>
            </View>
          ) : null}

          <View className="w-full gap-3">
            {this.props.showRetry !== false && (
              <TouchableOpacity
                className="w-full items-center rounded-lg bg-blue-800 px-6 py-3"
                onPress={this.handleRetry}
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons color="#ffffff" name="refresh-outline" size={18} />
                  <Text className="text-base font-semibold text-white">Try again</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              className="w-full items-center rounded-lg border border-gray-300 bg-white px-6 py-3"
              onPress={() => {
                // Try to navigate back if router is available
                // This will be handled by parent component if needed
              }}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons color="#374151" name="home-outline" size={18} />
                <Text className="text-base font-semibold text-gray-700">Back to home</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    return this.props.children;
  }
}

// Error boundary for camera operations (fallback to gallery)
export class CameraErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Camera error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-slate-50 p-6">
          <Ionicons color="#f59e0b" name="image-outline" size={64} />
          <Text className="mt-4 text-lg font-semibold text-gray-800">Camera unavailable</Text>
          <Text className="mt-2 text-center text-gray-500">
            Could not access camera. Please check permissions or use gallery instead.
          </Text>
          <Text className="mt-4 text-sm text-gray-400">{this.state.error?.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Error boundary for location operations
export class LocationErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Location error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-slate-50 p-6">
          <Ionicons color="#3b82f6" name="location-outline" size={64} />
          <Text className="mt-4 text-lg font-semibold text-gray-800">Location unavailable</Text>
          <Text className="mt-2 text-center text-gray-500">
            Could not access location services. Some features may be limited.
          </Text>
          <Text className="mt-4 text-sm text-gray-400">{this.state.error?.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Error boundary for file system operations
export class FileSystemErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('File system error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-slate-50 p-6">
          <Ionicons color="#10b981" name="document-outline" size={64} />
          <Text className="mt-4 text-lg font-semibold text-gray-800">Storage unavailable</Text>
          <Text className="mt-2 text-center text-gray-500">
            Could not access storage. Please check permissions.
          </Text>
          <Text className="mt-4 text-sm text-gray-400">{this.state.error?.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;