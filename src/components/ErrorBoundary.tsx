import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught render failure', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6 gap-4">
        <h1 className="text-xl font-semibold">
          {this.props.fallbackTitle ?? 'Something went wrong'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
          The page hit an unexpected error. Reload to try again, or go back to the home screen.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-[var(--primary-color)] text-white"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600"
          >
            Home
          </a>
        </div>
      </div>
    );
  }
}
