import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';

export function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      setReg(registration);
      
      if (registration.waiting) setShow(true);

      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', function() {
          if (this.state === 'installed' && navigator.serviceWorker.controller) {
            setShow(true);
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!show) return null;

  return (
    <div className="fixed top-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
      <Card className="shadow-lg">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Nueva versión</h3>
              <p className="text-xs text-muted-foreground">Actualiza para mejoras</p>
              <Button size="sm" className="mt-2 h-8" onClick={handleUpdate}>Actualizar</Button>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShow(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
