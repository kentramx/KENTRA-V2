import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { captureException, captureMessage } from '@/lib/sentry';
import { useToast } from '@/hooks/use-toast';

export const SentryTestButton = () => {
  const { toast } = useToast();

  const testSentryError = () => {
    // Enviar siempre el evento, incluso si la variable VITE no existe
    // (tenemos DSN de respaldo en src/lib/sentry.ts)
    try {
      // Generar un error de prueba
      throw new Error('This is your first error!');
    } catch (error) {
      // Además registrar un mensaje informativo para diagnóstico
      try {
        captureMessage('sentry_diagnostics: manual test triggered', 'info', {
          env: import.meta.env.MODE,
        });
      } catch {}

      // Capturar con Sentry
      captureException(error as Error, {
        test: true,
        source: 'manual_test_button',
        timestamp: new Date().toISOString(),
      });

      toast({
        title: '✅ Error de prueba enviado a Sentry',
        description: 'Revisa tu dashboard de Sentry para confirmar que el error fue capturado.',
        duration: 5000,
      });
    }
  };

  return (
    <Button
      onClick={testSentryError}
      variant="outline"
      size="sm"
      className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50"
    >
      <AlertCircle className="h-4 w-4" />
      Test Sentry
    </Button>
  );
};
