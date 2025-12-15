import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Package, Zap, ArrowRight } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getPricingRoute } from '@/utils/getPricingRoute';

interface PropertyLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: string | null;
}

export function PropertyLimitModal({ open, onOpenChange, userRole }: PropertyLimitModalProps) {
  const navigate = useNavigate();
  const { subscription, limits } = useSubscription();
  
  const pricingRoute = getPricingRoute(userRole, subscription?.plan?.name);

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/panel-agente?tab=subscription');
  };

  const handleViewPricing = () => {
    onOpenChange(false);
    navigate(pricingRoute);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
            <Package className="h-6 w-6 text-yellow-600" />
          </div>
          <DialogTitle className="text-center">
            Límite de Propiedades Alcanzado
          </DialogTitle>
          <DialogDescription className="text-center">
            Has alcanzado el máximo de propiedades de tu plan actual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Usage Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Propiedades usadas</span>
              <span className="font-medium">
                {limits.currentProperties} / {limits.maxProperties}
              </span>
            </div>
            <Progress value={100} className="h-2" />
          </div>

          {/* Current Plan */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plan actual</p>
                <p className="font-semibold">{subscription?.plan?.display_name || 'Sin plan'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Límite</p>
                <p className="font-semibold">{limits.maxProperties} propiedades</p>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-center">¿Qué puedes hacer?</p>
            
            <div className="grid gap-2">
              <Button 
                variant="outline" 
                className="justify-start h-auto py-3"
                onClick={handleUpgrade}
              >
                <TrendingUp className="h-5 w-5 mr-3 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">Actualizar tu plan</p>
                  <p className="text-xs text-muted-foreground">
                    Obtén más propiedades y funciones
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>

              <Button 
                variant="outline" 
                className="justify-start h-auto py-3"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/panel-agente');
                }}
              >
                <Package className="h-5 w-5 mr-3 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium">Administrar propiedades</p>
                  <p className="text-xs text-muted-foreground">
                    Pausa o elimina propiedades existentes
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cerrar
          </Button>
          <Button onClick={handleViewPricing} className="w-full sm:w-auto gap-2">
            <Zap className="h-4 w-4" />
            Ver Planes Disponibles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
