import { Button } from '@/components/ui/button';
import { Loader2, Check, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { ChangeType } from './types';

interface ConfirmChangeButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  changeType: ChangeType;
  selectedPlanName?: string;
}

export function ConfirmChangeButton({
  onClick,
  loading,
  disabled,
  changeType,
  selectedPlanName,
}: ConfirmChangeButtonProps) {
  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Procesando cambio...
        </>
      );
    }

    switch (changeType) {
      case 'upgrade':
        return (
          <>
            <TrendingUp className="w-4 h-4 mr-2" />
            Confirmar Upgrade{selectedPlanName ? ` a ${selectedPlanName}` : ''}
          </>
        );
      case 'downgrade':
        return (
          <>
            <TrendingDown className="w-4 h-4 mr-2" />
            Confirmar Downgrade{selectedPlanName ? ` a ${selectedPlanName}` : ''}
          </>
        );
      case 'cycle_change':
        return (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Cambiar Ciclo de Facturación
          </>
        );
      default:
        return (
          <>
            <Check className="w-4 h-4 mr-2" />
            Confirmar Cambio
          </>
        );
    }
  };

  const getButtonVariant = (): 'default' | 'secondary' => {
    if (changeType === 'downgrade') return 'secondary';
    return 'default';
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      variant={getButtonVariant()}
      className="w-full"
      size="lg"
    >
      {getButtonContent()}
    </Button>
  );
}
