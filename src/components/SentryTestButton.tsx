import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { captureException, captureMessage } from '@/lib/sentry';
import { useToast } from '@/hooks/use-toast';

export const SentryTestButton = () => {
  const { toast } = useToast();
  const DSN_PRESENT = Boolean(import.meta.env.VITE_SENTRY_DSN);

  const testSentryError = () => {
    if (!DSN_PRESENT) {
      toast({
        title: 'Sentry no está configurado',
        description: 'No se detectó VITE_SENTRY_DSN en el build actual. Si ya la agregaste, republish o indica tu DSN público para usarlo temporalmente.',
        duration: 6000,
        variant: 'destructive'
      });
      try {
        captureMessage('sentry_diagnostics: DSN missing in build', 'warning', {
          dsnPresent: DSN_PRESENT,
          env: import.meta.env.MODE,
        });
      } catch {}
      return;
    }

    try {
      // Generar un error de prueba
      throw new Error('This is your first error!');
    } catch (error) {
      // Capturar con Sentry
      captureException(error as Error, {
        test: true,
        source: 'manual_test_button',
        timestamp: new Date().toISOString(),
      });

      // También enviar un mensaje de prueba
      captureMessage('Sentry test button clicked - verification test', 'info', {
        test: true,
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
