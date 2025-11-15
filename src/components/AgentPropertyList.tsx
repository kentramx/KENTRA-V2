import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAgentProperties } from '@/hooks/useAgentProperties';
import { useDeleteProperty } from '@/hooks/usePropertyMutations';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, Star } from 'lucide-react';
import { FeaturePropertyDialog } from './FeaturePropertyDialog';
import { EmptyStatePublish } from './EmptyStatePublish';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Edit, Trash2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface RejectionRecord {
  date: string;
  reasons: string[];
  comments: string;
  reviewed_by: string;
  resubmission_number: number;
}

interface AgentPropertyListProps {
  onEdit: (property: any) => void;
  subscriptionInfo?: any;
  agentId?: string;
  onCreateProperty?: () => void;
}

const AgentPropertyList = ({ onEdit, subscriptionInfo, agentId, onCreateProperty }: AgentPropertyListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [featuredProperties, setFeaturedProperties] = useState<Set<string>>(new Set());
  const [featureProperty, setFeatureProperty] = useState<any>(null);

  // Fetch properties con React Query
  const effectiveAgentId = agentId || user?.id;
  const { data: properties = [], isLoading: loading, refetch } = useAgentProperties(effectiveAgentId);
  
  // Mutation para delete
  const deletePropertyMutation = useDeleteProperty();

  useEffect(() => {
    fetchFeaturedProperties();
  }, [effectiveAgentId]);

  const fetchFeaturedProperties = async () => {
    if (!effectiveAgentId) return;
    
    try {
      const { data: featuredData } = await supabase
        .from('featured_properties')
        .select('property_id')
        .eq('agent_id', effectiveAgentId)
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString());

      if (featuredData) {
        setFeaturedProperties(new Set(featuredData.map(f => f.property_id)));
      }
    } catch (error) {
      console.error('Error fetching featured properties:', error);
    }
  };

  const getDaysUntilExpiration = (expiresAt: string | null) => {
    if (!expiresAt) return 0;
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getRenewalBadgeVariant = (daysLeft: number): "default" | "secondary" | "destructive" => {
    if (daysLeft > 14) return 'default';
    if (daysLeft > 3) return 'secondary';
    return 'destructive';
  };

  const handleRenewProperty = async (propertyId: string) => {
    try {
      const { error } = await supabase.rpc('renew_property', {
        property_id: propertyId
      });
      
      if (error) throw error;
      
      toast({
        title: '✅ Renovado',
        description: 'Tu propiedad ha sido renovada por 30 días más',
      });
      
      // Invalidar caché de React Query
      queryClient.invalidateQueries({ queryKey: ['agent-properties', effectiveAgentId] });
      fetchFeaturedProperties();
    } catch (error) {
      console.error('Error renewing property:', error);
      toast({
        title: 'Error',
        description: 'No se pudo renovar la propiedad',
        variant: 'destructive',
      });
    }
  };

  const handleResubmitProperty = async (propertyId: string) => {
    try {
      const { data, error } = await supabase.rpc('resubmit_property' as any, {
        property_id: propertyId
      });
      
      if (error) throw error;
      
      if (!data?.success) {
        toast({
          title: 'Error',
          description: data?.error || 'Error desconocido',
          variant: 'destructive',
        });
        return;
      }
      
      toast({
        title: '✅ Reenviada',
        description: `Propiedad reenviada para revisión. Te quedan ${data?.remaining_attempts || 0} intentos.`,
      });
      
      // Invalidar caché de React Query
      queryClient.invalidateQueries({ queryKey: ['agent-properties', effectiveAgentId] });
    } catch (error) {
      console.error('Error resubmitting property:', error);
      toast({
        title: 'Error',
        description: 'No se pudo reenviar la propiedad',
        variant: 'destructive',
      });
    }
  };

  const handleReactivateProperty = async (propertyId: string) => {
    try {
      const { error } = await supabase.rpc('reactivate_property' as any, {
        property_id: propertyId
      });
      
      if (error) throw error;
      
      toast({
        title: '✅ Reactivada',
        description: 'Tu propiedad ha sido reactivada exitosamente',
      });
      
      // Invalidar caché de React Query
      queryClient.invalidateQueries({ queryKey: ['agent-properties', effectiveAgentId] });
    } catch (error) {
      console.error('Error reactivating property:', error);
      toast({
        title: 'Error',
        description: 'No se pudo reactivar la propiedad',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      // Get property images to delete from storage
      const property = properties.find(p => p.id === deleteId);
      if (property?.images) {
        for (const image of property.images) {
          const fileName = image.url.split('/').pop();
          if (fileName) {
            await supabase.storage
              .from('property-images')
              .remove([`${deleteId}/${fileName}`]);
          }
        }
      }

      // Delete property usando mutation
      await deletePropertyMutation.mutateAsync(deleteId);
      fetchFeaturedProperties();
    } catch (error) {
      console.error('Error deleting property:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la propiedad',
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <EmptyStatePublish 
        onCreateProperty={onCreateProperty || (() => {})}
        role="agent"
      />
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Propiedad</TableHead>
              <TableHead>Colonia</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Destacada</TableHead>
              <TableHead>Renovación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => (
              <TableRow key={property.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {property.images?.[0] && (
                      <img
                        src={property.images[0].url}
                        alt={property.title}
                        className="h-12 w-12 rounded object-cover"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{property.title}</p>
                        {featuredProperties.has(property.id) && (
                          <Badge variant="default" className="text-xs">
                            Destacada
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {(property as any).colonia ? (
                    <span className="font-medium text-foreground">
                      {(property as any).colonia}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      No especificada
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {property.municipality}, {property.state}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{property.type}</Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {formatPrice(property.price)}
                </TableCell>
                <TableCell>
                  {property.status === 'pendiente_aprobacion' ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          ⏳ Pendiente
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Tu propiedad está siendo revisada por un administrador
                      </TooltipContent>
                    </Tooltip>
                  ) : property.status === 'pausada' && (property as any).rejection_history?.length > 0 ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="destructive">
                          ❌ Rechazada
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {(() => {
                          const lastRejection = (property as any).rejection_history[(property as any).rejection_history.length - 1] as RejectionRecord;
                          return (
                            <>
                              <p className="font-semibold">Motivos: {lastRejection.reasons.join(', ')}</p>
                              {lastRejection.comments && (
                                <p className="text-xs mt-1">{lastRejection.comments}</p>
                              )}
                              <p className="text-xs mt-2 text-muted-foreground">
                                Reenvíos: {(property as any).resubmission_count || 0}/3
                              </p>
                            </>
                          );
                        })()}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Badge variant={property.status === 'activa' ? 'default' : 'secondary'}>
                      {property.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {featuredProperties.has(property.id) ? (
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Destacada
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFeatureProperty(property)}
                      disabled={!subscriptionInfo || subscriptionInfo.featured_used >= subscriptionInfo.featured_limit}
                      className="gap-1"
                    >
                      <Star className="h-3 w-3" />
                      Destacar
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  {(() => {
                    const daysLeft = getDaysUntilExpiration(property.expires_at);
                    const variant = getRenewalBadgeVariant(daysLeft);
                    return (
                      <div className="flex flex-col gap-2">
                        <Badge variant={variant} className="w-fit">
                          {daysLeft === 0 ? '¡Expira hoy!' : `${daysLeft} días`}
                        </Badge>
                        <Button
                          variant={daysLeft <= 3 ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => handleRenewProperty(property.id)}
                          className="gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {daysLeft <= 3 ? '¡Renovar ahora!' : 'Renovar'}
                        </Button>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/propiedad/${property.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(property)}
                      disabled={property.status === 'pendiente_aprobacion'}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(property.id)}
                      disabled={property.status === 'pendiente_aprobacion'}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    
                    {property.status === 'pausada' && (property as any).rejection_history?.length > 0 && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleResubmitProperty(property.id)}
                        disabled={(property as any).resubmission_count >= 3}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reenviar ({3 - ((property as any).resubmission_count || 0)})
                      </Button>
                    )}
                    
                    {property.status === 'pausada' && (!(property as any).rejection_history || (property as any).rejection_history.length === 0) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReactivateProperty(property.id)}
                      >
                        Reactivar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FeaturePropertyDialog
        property={featureProperty}
        open={!!featureProperty}
        onOpenChange={(open) => !open && setFeatureProperty(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['agent-properties', user?.id] });
          fetchFeaturedProperties();
        }}
        subscriptionInfo={subscriptionInfo}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar propiedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La propiedad y todas sus imágenes
              serán eliminadas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePropertyMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletePropertyMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePropertyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AgentPropertyList;
