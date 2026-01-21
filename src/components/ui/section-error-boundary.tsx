import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { monitoring } from '@/lib/monitoring';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  sectionName?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Lightweight error boundary for individual page sections
 * Use this to prevent a single component failure from breaking the entire page
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    monitoring.captureException(error, {
      component: 'SectionErrorBoundary',
      section: this.props.sectionName || 'unknown',
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-muted/50 rounded-lg border border-border">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground text-center mb-3">
            {this.props.fallbackMessage || 'No se pudo cargar esta sección'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap components with section error boundary
 */
export function withSectionErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: { sectionName?: string; fallbackMessage?: string } = {}
) {
  return function WrappedComponent(props: P) {
    return (
      <SectionErrorBoundary
        sectionName={options.sectionName}
        fallbackMessage={options.fallbackMessage}
      >
        <Component {...props} />
      </SectionErrorBoundary>
    );
  };
}
