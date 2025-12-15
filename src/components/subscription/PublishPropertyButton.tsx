import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonProps } from '@/components/ui/button';
import { Plus, Lock, Loader2 } from 'lucide-react';
import { useSubscription, useCanCreateProperty } from '@/contexts/SubscriptionContext';
import { PropertyLimitModal } from './PropertyLimitModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';

interface PublishPropertyButtonProps extends Omit<ButtonProps, 'onClick'> {
  showIcon?: boolean;
  label?: string;
}

export function PublishPropertyButton({ 
  showIcon = true, 
  label = 'Publicar Propiedad',
  className,
  ...props 
}: PublishPropertyButtonProps) {
  const navigate = useNavigate();
  const { user, isEmailVerified } = useAuth();
  const { userRole, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const { isLoading: subLoading, hasSubscription, isActive } = useSubscription();
  const { canCreate, reason, remaining } = useCanCreateProperty();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleClick = () => {
    // Not logged in
    if (!user) {
      navigate('/auth?redirect=/panel-agente&action=publicar');
      return;
    }

    // Still loading role
    if (roleLoading) {
      return;
    }

    // Check email verification for agents/agencies
    if ((userRole === 'agent' || userRole === 'agency') && !isEmailVerified()) {
      toast({
        title: '⚠️ Email no verificado',
        description: 'Verifica tu email antes de publicar propiedades',
        variant: 'destructive',
      });
      navigate('/perfil?tab=profile');
      return;
    }

    // If buyer role, redirect to pricing
    if (userRole === 'buyer' || !userRole) {
      navigate('/pricing-agente');
      return;
    }

    // No active subscription - redirect to pricing
    if (!hasSubscription || !isActive) {
      const pricingRoute = userRole === 'agency' ? '/pricing-inmobiliaria' : '/pricing-agente';
      navigate(pricingRoute);
      return;
    }

    // Has subscription but at limit
    if (!canCreate) {
      setShowLimitModal(true);
      return;
    }

    // Can create - navigate to form
    const dashboardRoute = userRole === 'agency' ? '/panel-inmobiliaria?tab=form' : '/panel-agente?tab=form';
    navigate(dashboardRoute);
  };

  const isDisabled = subLoading || roleLoading;
  const showLock = !canCreate && hasSubscription && isActive;

  const buttonContent = (
    <>
      {subLoading || roleLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : showLock ? (
        <Lock className="h-4 w-4" />
      ) : showIcon ? (
        <Plus className="h-4 w-4" />
      ) : null}
      <span className={cn((showIcon || showLock || subLoading || roleLoading) && 'ml-2')}>
        {subLoading || roleLoading ? 'Cargando...' : label}
      </span>
      {canCreate && remaining > 0 && remaining <= 3 && (
        <span className="ml-1 text-xs opacity-70">({remaining})</span>
      )}
    </>
  );

  // Show tooltip if there's a reason
  if (reason && !subLoading && !roleLoading) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleClick}
                disabled={isDisabled}
                className={cn('gap-0', className)}
                {...props}
              >
                {buttonContent}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{reason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PropertyLimitModal open={showLimitModal} onOpenChange={setShowLimitModal} userRole={userRole} />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isDisabled}
        className={cn('gap-0', className)}
        {...props}
      >
        {buttonContent}
      </Button>
      <PropertyLimitModal open={showLimitModal} onOpenChange={setShowLimitModal} userRole={userRole} />
    </>
  );
}
