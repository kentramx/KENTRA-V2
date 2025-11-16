import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Star, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMonitoring } from '@/lib/monitoring';

interface FeaturePropertyDialogProps {
  property: {
    id: string;
    title: string;
    price: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  subscriptionInfo: {
    featured_used: number;
    featured_limit: number;
    plan_display_name: string;
  } | null;
}

const FEATURED_COST = 500; // Costo en MXN por 30 días
const FEATURED_DURATION_DAYS = 30;

export const FeaturePropertyDialog = ({
  property,
  open,
  onOpenChange,
  onSuccess,
  subscriptionInfo,
}: FeaturePropertyDialogProps) => {
  const { toast } = useToast();
  const { error: logError, captureException } = useMonitoring();
  const [loading, setLoading] = useState(false);

  const canFeature = subscriptionInfo 
    ? subscriptionInfo.featured_used < subscriptionInfo.featured_limit
    : false;

  const availableSlots = subscriptionInfo 
    ? subscriptionInfo.featured_limit - subscriptionInfo.featured_used
    : 0;

  const handleFeature = async () => {
    if (!property || !canFeature) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + FEATURED_DURATION_DAYS);

      const { error } = await supabase
        .from('featured_properties')
        .insert({
          property_id: property.id,
          agent_id: user.id,
          end_date: endDate.toISOString(),
          cost: FEATURED_COST,
          status: 'active',
          featured_type: 'standard',
        });

      if (error) throw error;

      toast({
        title: '✨ ¡Propiedad destacada!',
        description: `${property.title} ahora aparece en las búsquedas destacadas por ${FEATURED_DURATION_DAYS} días`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      logError('Error featuring property', {
        component: 'FeaturePropertyDialog',
        propertyId: property.id,
        error,
      });
      captureException(error, {
        component: 'FeaturePropertyDialog',
        action: 'handleFeature',
        propertyId: property.id,
      });
      toast({
        title: 'Error',
        description: 'No se pudo destacar la propiedad',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Destacar Propiedad
          </DialogTitle>
          <DialogDescription>
            Aumenta la visibilidad de tu propiedad destacándola en los resultados de búsqueda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Información de la propiedad */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="font-semibold mb-2">{property.title}</h4>
            <p className="text-sm text-muted-foreground">
              Precio: {new Intl.NumberFormat('es-MX', {
                style: 'currency',
                currency: 'MXN',
                minimumFractionDigits: 0,
              }).format(property.price)}
            </p>
          </div>

          {/* Detalles del destacado */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Duración: <strong>{FEATURED_DURATION_DAYS} días</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>Costo: <strong className="text-primary">
                {new Intl.NumberFormat('es-MX', {
                  style: 'currency',
                  currency: 'MXN',
                  minimumFractionDigits: 0,
                }).format(FEATURED_COST)}
              </strong></span>
            </div>
          </div>

          {/* Estado del plan */}
          {subscriptionInfo && (
            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Slots disponibles</span>
                <Badge variant={canFeature ? 'default' : 'secondary'}>
                  Plan {subscriptionInfo.plan_display_name}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">
                  {availableSlots}
                </span>
                <span className="text-sm text-muted-foreground">
                  de {subscriptionInfo.featured_limit} destacadas disponibles
                </span>
              </div>
            </div>
          )}

          {/* Alerta si no hay slots */}
          {!canFeature && subscriptionInfo && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Has usado tus {subscriptionInfo.featured_limit} destacadas de este mes ({subscriptionInfo.featured_used}/{subscriptionInfo.featured_limit}).
                {' '}
                El contador se resetea el 1ro del próximo mes.
                {' '}
                <button 
                  onClick={() => onOpenChange(false)}
                  className="underline font-semibold"
                >
                  Mejora tu plan
                </button> para tener más destacadas mensuales.
              </AlertDescription>
            </Alert>
          )}

          {/* Beneficios */}
          <div className="rounded-lg bg-primary/5 p-4">
            <h5 className="font-semibold text-sm mb-2">Beneficios de destacar:</h5>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✓ Aparece en la parte superior de las búsquedas</li>
              <li>✓ Badge especial "Destacada" en el listado</li>
              <li>✓ Mayor visibilidad y clicks</li>
              <li>✓ Incrementa hasta 3x las visitas</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleFeature}
            disabled={loading || !canFeature}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Destacando...
              </>
            ) : (
              <>
                <Star className="mr-2 h-4 w-4" />
                Destacar por {new Intl.NumberFormat('es-MX', {
                  style: 'currency',
                  currency: 'MXN',
                  minimumFractionDigits: 0,
                }).format(FEATURED_COST)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
