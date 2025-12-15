import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, ShieldCheck } from 'lucide-react';
import { CooldownInfo } from './types';

interface CooldownWarningProps {
  cooldownInfo: CooldownInfo;
  isAdmin?: boolean;
}

export function CooldownWarning({ cooldownInfo, isAdmin = false }: CooldownWarningProps) {
  if (!cooldownInfo.isInCooldown) {
    return null;
  }

  // Admin bypass message
  if (isAdmin && cooldownInfo.canBypass) {
    return (
      <Alert className="mb-4 border-purple-500/50 bg-purple-50 dark:bg-purple-950/20">
        <ShieldCheck className="h-4 w-4 text-purple-600" />
        <AlertTitle className="text-purple-800 dark:text-purple-300">Modo Administrador</AlertTitle>
        <AlertDescription className="text-purple-700 dark:text-purple-400">
          El usuario tiene un período de cooldown activo ({cooldownInfo.daysRemaining} días restantes), 
          pero como administrador puedes ignorar esta restricción.
        </AlertDescription>
      </Alert>
    );
  }

  // Regular user cooldown message
  return (
    <Alert variant="destructive" className="mb-4">
      <Clock className="h-4 w-4" />
      <AlertTitle>Cambio de plan no disponible</AlertTitle>
      <AlertDescription>
        Debes esperar <strong>{cooldownInfo.daysRemaining} días</strong> antes de poder 
        cambiar de plan nuevamente.
        {cooldownInfo.lastChangeDate && (
          <span className="block mt-1">
            Tu último cambio fue el{' '}
            {new Date(cooldownInfo.lastChangeDate).toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
