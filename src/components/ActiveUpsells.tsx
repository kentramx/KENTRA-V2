import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, Package, Star, Calendar, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMonitoring } from '@/lib/monitoring';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { useState } from 'react';

interface ActiveUpsellsProps {
  userId: string;
}

export const ActiveUpsells = ({ userId }: ActiveUpsellsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { error: logError, captureException } = useMonitoring();

  // Query para upsells activos
  const { data: activeUpsells = [], isLoading } = useQuery({
    queryKey: ['active-upsells', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_active_upsells')
        .select(`
          *,
          upsells (
            name,
            description,
            price,
            is_recurring,
            icon_name
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Query para propiedades destacadas activas
  const { data: featuredProperties = [], isLoading: loadingFeatured } = useQuery({
    queryKey: ['active-featured', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('featured_properties')
        .select(`
          *,
          properties (
            title,
            colonia,
            municipality
          )
        `)
        .eq('agent_id', userId)
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString())
        .order('end_date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Mutation para cancelar upsell
  const cancelUpsell = useMutation({
    mutationFn: async (upsellId: string) => {
      const { error } = await supabase
        .from('user_active_upsells')
        .update({ status: 'cancelled', auto_renew: false })
        .eq('id', upsellId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-upsells', userId] });
      toast({
        title: 'Upsell cancelado',
        description: 'El servicio adicional ha sido cancelado exitosamente',
      });
      setCancellingId(null);
    },
    onError: (error) => {
      logError('Error cancelling upsell', {
        component: 'ActiveUpsells',
        userId,
        error,
      });
      captureException(error as Error, {
        component: 'ActiveUpsells',
        action: 'cancelUpsell',
        userId,
      });
      toast({
        title: 'Error',
        description: 'No se pudo cancelar el servicio adicional',
        variant: 'destructive',
      });
      setCancellingId(null);
    },
  });

  if (isLoading || loadingFeatured) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const hasActiveItems = activeUpsells.length > 0 || featuredProperties.length > 0;

  return (
    <div className="space-y-6">
      {/* Upsells Recurrentes Activos */}
      {activeUpsells.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Servicios Adicionales Activos
            </CardTitle>
            <CardDescription>
              Servicios complementarios que has contratado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeUpsells.map((item) => {
                const upsell = item.upsells;
                const isExpiringSoon = item.end_date && 
                  new Date(item.end_date).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{upsell?.name}</h4>
                        {item.auto_renew && (
                          <Badge variant="secondary" className="text-xs">
                            Renovación automática
                          </Badge>
                        )}
                        {isExpiringSoon && !item.auto_renew && (
                          <Badge variant="destructive" className="text-xs">
                            Próximo a vencer
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {upsell?.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {item.end_date ? (
                            <span>
                              Vence: {format(new Date(item.end_date), "d 'de' MMMM, yyyy", { locale: es })}
                            </span>
                          ) : (
                            <span>Activo desde {format(new Date(item.start_date), "d 'de' MMMM", { locale: es })}</span>
                          )}
                        </div>
                        <div className="font-semibold">
                          ${upsell?.price.toLocaleString('es-MX')} MXN
                        </div>
                      </div>
                    </div>

                    {item.auto_renew && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCancellingId(item.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Propiedades Destacadas Activas */}
      {featuredProperties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Propiedades Destacadas
            </CardTitle>
            <CardDescription>
              Propiedades con visibilidad premium actualmente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {featuredProperties.map((featured) => {
                const property = featured.properties;
                const daysRemaining = Math.ceil(
                  (new Date(featured.end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
                );
                const isExpiringSoon = daysRemaining <= 3;

                return (
                  <div
                    key={featured.id}
                    className="flex items-start justify-between gap-4 p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">
                          {property?.title || 'Propiedad'}
                        </h4>
                        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-400">
                          Destacada
                        </Badge>
                        {isExpiringSoon && (
                          <Badge variant="destructive" className="text-xs">
                            {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'} restantes
                          </Badge>
                        )}
                      </div>
                      {property && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {property.colonia ? `${property.colonia}, ` : ''}{property.municipality}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Desde {format(new Date(featured.start_date), "d 'de' MMMM", { locale: es })} hasta{' '}
                            {format(new Date(featured.end_date), "d 'de' MMMM", { locale: es })}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="font-medium">{featured.impressions || 0}</span> impresiones · 
                        <span className="font-medium ml-1">{featured.clicks || 0}</span> clics
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado vacío */}
      {!hasActiveItems && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tienes servicios adicionales activos</h3>
            <p className="text-sm text-muted-foreground">
              Explora los servicios adicionales disponibles para mejorar la visibilidad de tus propiedades
            </p>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de confirmación de cancelación */}
      <AlertDialog open={!!cancellingId} onOpenChange={() => setCancellingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar servicio adicional?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cancelará la renovación automática de este servicio. Seguirás teniendo acceso hasta la fecha de vencimiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener servicio</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancellingId && cancelUpsell.mutate(cancellingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cancelar renovación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
