import { useRoleImpersonation, ImpersonatedRole } from '@/hooks/useRoleImpersonation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const RoleImpersonationSelector = () => {
  const { impersonatedRole, isImpersonating, isSuperAdmin, startImpersonation, stopImpersonation } = useRoleImpersonation();

  if (!isSuperAdmin) return null;

  const handleRoleChange = (value: string) => {
    if (value === 'none') {
      stopImpersonation();
      window.location.reload();
    } else {
      startImpersonation(value as ImpersonatedRole);
      window.location.reload();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Eye className="h-4 w-4 text-muted-foreground" />
      <Select value={impersonatedRole || 'none'} onValueChange={handleRoleChange}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Ver como..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4" />
              <span>Vista Normal</span>
            </div>
          </SelectItem>
          <SelectItem value="buyer">Comprador</SelectItem>
          <SelectItem value="agent">Agente</SelectItem>
          <SelectItem value="agency">Inmobiliaria</SelectItem>
          <SelectItem value="moderator">Moderador</SelectItem>
        </SelectContent>
      </Select>
      {isImpersonating && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            stopImpersonation();
            window.location.reload();
          }}
          className="h-9"
        >
          Salir
        </Button>
      )}
    </div>
  );
};
