import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAgentProperties } from '@/hooks/useAgentProperties';
import { useDeleteProperty } from '@/hooks/usePropertyMutations';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { 
  Search, 
  Grid3X3, 
  List, 
  Star, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { FeaturePropertyDialog } from './FeaturePropertyDialog';
import { PropertyCardAgent } from './PropertyCardAgent';
import { EmptyStatePublish } from './EmptyStatePublish';
import { useMonitoring } from '@/lib/monitoring';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
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
import { cn } from '@/lib/utils';

interface RejectionRecord {
  date: string;
  reasons: string[];
  comments: string;
  reviewed_by: string;
  resubmission_number: number;
}

type FilterType = 'all' | 'active' | 'featured' | 'pending' | 'rejected' | 'expiring';

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
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<string | null>(null);
  const { error: logError, warn, captureException } = useMonitoring();

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
      warn('Error fetching featured properties', {
        component: 'AgentPropertyList',
        agentId: effectiveAgentId,
        error,
      });
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

  // Counts for filter chips
  const counts = useMemo(() => ({
    all: properties.length,
    active: properties.filter(p => p.status === 'activa').length,
    featured: featuredProperties.size,
    pending: properties.filter(p => p.status === 'pendiente_aprobacion').length,
    rejected: properties.filter(p => 
      p.status === 'pausada' && (p as any).rejection_history?.length > 0
    ).length,
    expiring: properties.filter(p => 
      p.status === 'activa' && getDaysUntilExpiration(p.expires_at) <= 7
    ).length,
  }), [properties, featuredProperties]);

  // Filtered properties
  const filteredProperties = useMemo(() => {
    return properties
      .filter(p => {
        // Text search
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            p.title.toLowerCase().includes(query) ||
            (p as any).property_code?.toLowerCase().includes(query) ||
            (p as any).colonia?.toLowerCase().includes(query) ||
            p.municipality?.toLowerCase().includes(query) ||
            p.state?.toLowerCase().includes(query) ||
            p.type?.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .filter(p => {
        // Filter by status
        switch (activeFilter) {
          case 'active': return p.status === 'activa';
          case 'featured': return featuredProperties.has(p.id);
          case 'pending': return p.status === 'pendiente_aprobacion';
          case 'rejected': return p.status === 'pausada' && (p as any).rejection_history?.length > 0;
          case 'expiring': return p.status === 'activa' && getDaysUntilExpiration(p.expires_at) <= 7;
          default: return true;
        }
      });
  }, [properties, searchQuery, activeFilter, featuredProperties]);

  // Toggle featured (add or remove)
  const handleToggleFeatured = async (property: any) => {
    const isFeatured = featuredProperties.has(property.id);
    setTogglingFeaturedId(property.id);

    try {
      if (isFeatured) {
        // Remove featured
        const { error } = await supabase
          .from('featured_properties')
          .update({ status: 'cancelled' })
          .eq('property_id', property.id)
          .eq('agent_id', effectiveAgentId)
          .eq('status', 'active');

        if (error) throw error;

        toast({
          title: '⭐ Destacado removido',
          description: 'El slot ha sido liberado y puede usarse en otra propiedad',
        });
        fetchFeaturedProperties();
      } else {
        // Add featured - open dialog
        setFeatureProperty(property);
      }
    } catch (error) {
      logError('Error toggling featured', {
        component: 'AgentPropertyList',
        propertyId: property.id,
        error,
      });
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el destacado',
        variant: 'destructive',
      });
    } finally {
      setTogglingFeaturedId(null);
    }
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
      
      queryClient.invalidateQueries({ queryKey: ['agent-properties', effectiveAgentId] });
    } catch (error) {
      logError('Error renewing property', { component: 'AgentPropertyList', propertyId, error });
      captureException(error as Error, { component: 'AgentPropertyList', action: 'renewProperty', propertyId });
      toast({ title: 'Error', description: 'No se pudo renovar la propiedad', variant: 'destructive' });
    }
  };

  const handleResubmitProperty = async (propertyId: string) => {
    try {
      const { data, error } = await supabase.rpc('resubmit_property' as any, { property_id: propertyId });
      
      if (error) {
        toast({ title: 'Error', description: error.message || 'No se pudo conectar', variant: 'destructive' });
        return;
      }

      if (!data?.success) {
        toast({ title: 'No se pudo reenviar', description: data?.error || 'Error desconocido', variant: 'destructive' });
        return;
      }
      
      toast({
        title: '✅ Reenviada para revisión',
        description: `La propiedad está en revisión. Intentos restantes: ${data.remaining_attempts}`,
      });

      try {
        await supabase.functions.invoke('notify-admin-resubmission', {
          body: {
            propertyId,
            propertyTitle: data.property_title,
            agentName: data.agent_name,
            resubmissionNumber: data.resubmission_number
          }
        });
      } catch (notificationError) {
        warn('Error sending admin notification after resubmit', { component: 'AgentPropertyList', propertyId, error: notificationError });
      }
      
      queryClient.invalidateQueries({ queryKey: ['agent-properties', effectiveAgentId] });
    } catch (error) {
      logError('Error resubmitting property', { component: 'AgentPropertyList', propertyId, error });
      captureException(error as Error, { component: 'AgentPropertyList', action: 'resubmitProperty', propertyId });
      toast({ title: 'Error', description: 'No se pudo reenviar la propiedad', variant: 'destructive' });
    }
  };

  const handleReactivateProperty = async (propertyId: string) => {
    try {
      const { error } = await supabase.rpc('reactivate_property' as any, { property_id: propertyId });
      
      if (error) throw error;
      
      toast({ title: '✅ Reactivada', description: 'Tu propiedad ha sido reactivada exitosamente' });
      queryClient.invalidateQueries({ queryKey: ['agent-properties', effectiveAgentId] });
    } catch (error) {
      logError('Error reactivating property', { component: 'AgentPropertyList', propertyId, error });
      captureException(error as Error, { component: 'AgentPropertyList', action: 'reactivateProperty', propertyId });
      toast({ title: 'Error', description: 'No se pudo reactivar la propiedad', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const property = properties.find(p => p.id === deleteId);
      if (property?.images) {
        for (const image of property.images) {
          const fileName = image.url.split('/').pop();
          if (fileName) {
            await supabase.storage.from('property-images').remove([`${deleteId}/${fileName}`]);
          }
        }
      }

      await deletePropertyMutation.mutateAsync(deleteId);
      fetchFeaturedProperties();
    } catch (error) {
      logError('Error deleting property', { component: 'AgentPropertyList', propertyId: deleteId, error });
      captureException(error as Error, { component: 'AgentPropertyList', action: 'deleteProperty', propertyId: deleteId });
      toast({ title: 'Error', description: 'No se pudo eliminar la propiedad', variant: 'destructive' });
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

  const filterChips: { key: FilterType; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'all', label: 'Todas', icon: Grid3X3, count: counts.all },
    { key: 'active', label: 'Activas', icon: CheckCircle, count: counts.active },
    { key: 'featured', label: 'Destacadas', icon: Star, count: counts.featured },
    { key: 'pending', label: 'Pendientes', icon: Clock, count: counts.pending },
    { key: 'rejected', label: 'Rechazadas', icon: XCircle, count: counts.rejected },
    { key: 'expiring', label: 'Por vencer', icon: AlertCircle, count: counts.expiring },
  ];

  return (
    <>
      {/* Search and filters bar */}
      <div className="space-y-4 mb-6">
        {/* Search + View toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, código, colonia, ubicación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(val) => val && setViewMode(val as 'grid' | 'list')}
            className="hidden sm:flex"
          >
            <ToggleGroupItem value="grid" aria-label="Vista grid">
              <Grid3X3 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Vista lista">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {filterChips.map((chip) => {
            const Icon = chip.icon;
            const isActive = activeFilter === chip.key;
            return (
              <Button
                key={chip.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter(chip.key)}
                className={cn(
                  "gap-1.5 transition-all",
                  chip.key === 'expiring' && chip.count > 0 && !isActive && "border-destructive/50 text-destructive hover:bg-destructive/10",
                  chip.key === 'featured' && chip.count > 0 && !isActive && "border-amber-500/50 text-amber-600 hover:bg-amber-50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {chip.label}
                <Badge 
                  variant={isActive ? 'secondary' : 'outline'} 
                  className={cn(
                    "ml-1 h-5 px-1.5 text-xs",
                    isActive && "bg-background/20 text-inherit"
                  )}
                >
                  {chip.count}
                </Badge>
              </Button>
            );
          })}
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2.5">
          <span>Total: <strong className="text-foreground">{counts.all}</strong></span>
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <span>Activas: <strong className="text-foreground">{counts.active}</strong></span>
          <Separator orientation="vertical" className="h-4 hidden sm:block" />
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-500" />
            Destacadas: 
            <strong className="text-foreground">
              {counts.featured}/{subscriptionInfo?.featured_limit || 0}
            </strong>
          </span>
          {counts.expiring > 0 && (
            <>
              <Separator orientation="vertical" className="h-4 hidden sm:block" />
              <span className="text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Por vencer: <strong>{counts.expiring}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Empty state for filtered results */}
      {filteredProperties.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No se encontraron propiedades</p>
          <p className="text-sm">Intenta con otros filtros o términos de búsqueda</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProperties.map((property) => (
            <PropertyCardAgent
              key={property.id}
              property={{
                ...property,
                colonia: (property as any).colonia,
                property_code: (property as any).property_code,
                rejection_history: (property as any).rejection_history,
                resubmission_count: (property as any).resubmission_count,
              }}
              isFeatured={featuredProperties.has(property.id)}
              subscriptionInfo={subscriptionInfo}
              onView={() => navigate(`/propiedad/${property.id}`)}
              onEdit={() => onEdit(property)}
              onDelete={() => setDeleteId(property.id)}
              onToggleFeatured={() => handleToggleFeatured(property)}
              onRenew={() => handleRenewProperty(property.id)}
              onResubmit={
                property.status === 'pausada' && (property as any).rejection_history?.length > 0
                  ? () => handleResubmitProperty(property.id)
                  : undefined
              }
              onReactivate={
                property.status === 'pausada' && !(property as any).rejection_history?.length
                  ? () => handleReactivateProperty(property.id)
                  : undefined
              }
              isTogglingFeatured={togglingFeaturedId === property.id}
            />
          ))}
        </div>
      ) : (
        /* List/Table view */
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead className="hidden md:table-cell">Ubicación</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Destacada</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProperties.map((property) => {
                const isFeatured = featuredProperties.has(property.id);
                const daysLeft = getDaysUntilExpiration(property.expires_at);
                
                return (
                  <TableRow key={property.id} className={cn(isFeatured && "bg-amber-50/50")}>
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
                            <p className="font-medium line-clamp-1">{property.title}</p>
                            {isFeatured && (
                              <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                            )}
                          </div>
                          <Badge variant="outline" className="font-mono text-xs mt-1">
                            {(property as any).property_code || property.id.slice(0, 8)}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {(property as any).colonia ? `${(property as any).colonia}, ` : ''}
                        {property.municipality}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPrice(property.price)}
                    </TableCell>
                    <TableCell>
                      {property.status === 'activa' ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default">Activa</Badge>
                          {daysLeft <= 7 && (
                            <Badge variant="destructive" className="text-xs">
                              {daysLeft}d
                            </Badge>
                          )}
                        </div>
                      ) : property.status === 'pendiente_aprobacion' ? (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                          ⏳ Pendiente
                        </Badge>
                      ) : (property as any).rejection_history?.length > 0 ? (
                        <Badge variant="destructive">❌ Rechazada</Badge>
                      ) : (
                        <Badge variant="secondary">{property.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Button
                        variant={isFeatured ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleFeatured(property)}
                        disabled={togglingFeaturedId === property.id || (!isFeatured && subscriptionInfo?.featured_used >= subscriptionInfo?.featured_limit)}
                        className={cn("gap-1", isFeatured && "bg-amber-500 hover:bg-amber-600")}
                      >
                        {togglingFeaturedId === property.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Star className={cn("h-3.5 w-3.5", isFeatured && "fill-current")} />
                        )}
                        {isFeatured ? 'Quitar' : 'Destacar'}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/propiedad/${property.id}`)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(property)} disabled={property.status === 'pendiente_aprobacion'}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(property.id)} disabled={property.status === 'pendiente_aprobacion'}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Eliminar</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <FeaturePropertyDialog
        property={featureProperty}
        open={!!featureProperty}
        onOpenChange={(open) => !open && setFeatureProperty(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['agent-properties', effectiveAgentId] });
          fetchFeaturedProperties();
        }}
        subscriptionInfo={subscriptionInfo ? { ...subscriptionInfo, featured_used: featuredProperties.size } : null}
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
