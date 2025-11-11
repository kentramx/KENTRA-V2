import { useRoleImpersonation } from '@/hooks/useRoleImpersonation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const roleNames = {
  buyer: 'Comprador',
  agent: 'Agente',
  agency: 'Inmobiliaria',
  moderator: 'Moderador',
};

export const ImpersonationBanner = () => {
  const { impersonatedRole, isImpersonating, stopImpersonation } = useRoleImpersonation();

  if (!isImpersonating || !impersonatedRole) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-warning/10 border-warning">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm font-medium">
            Modo de Simulación Activo: Viendo como{' '}
            <span className="font-bold">{roleNames[impersonatedRole]}</span>
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            stopImpersonation();
            window.location.reload();
          }}
          className="h-8 gap-2"
        >
          <X className="h-4 w-4" />
          Salir de Simulación
        </Button>
      </div>
    </Alert>
  );
};
