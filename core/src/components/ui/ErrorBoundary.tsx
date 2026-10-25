import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button.tsx';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="paper-card p-6 sm:p-10 max-w-lg w-full text-center border border-[#E9E1D3] shadow-md bg-[#FFFDF8]">
            <div className="w-12 h-12 rounded-full bg-[#FDECEB] text-[#D64545] flex items-center justify-center mx-auto mb-4 border border-[#D64545]/30">
              <AlertCircle className="w-6 h-6" />
            </div>

            <span className="font-script text-xl text-[#E8622C] font-bold block mb-1">
              Oops! Something unexpected happened ✦
            </span>
            <h2 className="font-serif text-2xl font-bold text-[#1A1A1A] mb-2">
              Something went wrong
            </h2>
            <p className="text-xs sm:text-sm text-[#5E5A52] mb-6">
              {this.state.error?.message || 'An error occurred while loading this section.'}
            </p>

            <div className="flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Reload Page
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
              >
                <Home className="w-4 h-4 mr-1.5" />
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
