import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Llamar callback personalizado si existe
    this.props.onError?.(error, errorInfo);

    // En producción, enviar a Sentry u otro servicio
    if (import.meta.env.PROD) {
      // TODO: Integrar con Sentry cuando esté configurado
      // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }

    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Si hay un fallback personalizado, usarlo
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Fallback por defecto
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle>Algo salió mal</CardTitle>
              </div>
              <CardDescription>
                Lo sentimos, ha ocurrido un error inesperado. Por favor intenta recargar la página.
              </CardDescription>
            </CardHeader>
            
            {import.meta.env.DEV && this.state.error && (
              <CardContent>
                <div className="bg-muted p-4 rounded-md overflow-auto max-h-64">
                  <p className="font-mono text-sm text-destructive font-semibold mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </CardContent>
            )}

            <CardFooter className="flex gap-2">
              <Button onClick={this.handleReset} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Intentar de nuevo
              </Button>
              <Button onClick={() => window.location.reload()}>
                Recargar página
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook para usar ErrorBoundary con componentes funcionales
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
};
