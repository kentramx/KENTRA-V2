import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FeaturePropertyDialog } from './FeaturePropertyDialog';
import { useMonitoring } from '@/lib/monitoring';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Eye, Filter, Users, UserCog, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AgencyInventoryProps {
  agencyId: string;
  subscriptionInfo?: any;
}

export const AgencyInventory = ({ agencyId, subscriptionInfo }: AgencyInventoryProps) => {
  const { toast } = useToast();
  const { error: logError, warn, captureException } = useMonitoring();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [selectedNewAgent, setSelectedNewAgent] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [featuredProperties, setFeaturedProperties] = useState<Set<string>>(new Set());
  const [featureProperty, setFeatureProperty] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [agencyId]);

  const loadData = async () => {
    await fetchAgents();
    const loadedProperties = await fetchProperties();
    // Fetch featured después de que properties esté cargado
    if (loadedProperties && loadedProperties.length > 0) {
      await fetchFeaturedProperties(loadedProperties);
    }
  };

  const fetchFeaturedProperties = async (propertiesToCheck: any[] = properties) => {
    if (propertiesToCheck.length === 0) return;

    try {
      const propertyIds = propertiesToCheck.map(p => p.id);
      
      const { data: featuredData } = await supabase
        .from('featured_properties')
        .select('property_id')
        .in('property_id', propertyIds)
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString());

      if (featuredData) {
        setFeaturedProperties(new Set(featuredData.map(f => f.property_id)));
      }
    } catch (error) {
      warn('Error fetching featured properties', {
        component: 'AgencyInventory',
        agencyId,
        error,
      });
    }
  };

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_agents')
        .select(`
          agent_id,
          profiles:agent_id (
            id,
            name
          )
        `)
        .eq('agency_id', agencyId)
        .eq('status', 'active');

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      warn('Error fetching agency agents', {
        component: 'AgencyInventory',
        agencyId,
        error,
      });
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          images (
            id,
            url,
            position
          ),
          profiles:agent_id (
            id,
            name
          )
        `)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties(data || []);
      return data || [];
    } catch (error) {
      warn('Error fetching agency properties', {
        component: 'AgencyInventory',
        agencyId,
        error,
      });
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las propiedades',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleOpenAssignDialog = (property: any) => {
    setSelectedProperty(property);
    setSelectedNewAgent(property.agent_id || '');
    setAssignDialogOpen(true);
  };

  const handleAssignProperty = async () => {
    if (!selectedProperty || !selectedNewAgent) return;

    setAssigning(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({ agent_id: selectedNewAgent })
        .eq('id', selectedProperty.id);

      if (error) throw error;

      toast({
        title: '✅ Propiedad reasignada',
        description: 'La propiedad ha sido asignada al nuevo agente',
      });

      setAssignDialogOpen(false);
      setSelectedProperty(null);
      setSelectedNewAgent('');
      fetchProperties();
    } catch (error) {
      logError('Error assigning property to agent', {
        component: 'AgencyInventory',
        propertyId: selectedProperty?.id,
        newAgentId: selectedNewAgent,
        error,
      });
      captureException(error as Error, {
        component: 'AgencyInventory',
        action: 'assignProperty',
        propertyId: selectedProperty?.id,
      });
      toast({
        title: 'Error',
        description: 'No se pudo reasignar la propiedad',
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
    }
  };

  const filteredProperties = properties.filter((property) => {
    if (filterAgent !== 'all' && property.agent_id !== filterAgent) return false;
    if (filterStatus !== 'all' && property.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: properties.length,
    activas: properties.filter(p => p.status === 'activa').length,
    vendidas: properties.filter(p => p.status === 'vendida').length,
    rentadas: properties.filter(p => p.status === 'rentada').length,
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Propiedades</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Activas</p>
          <p className="text-2xl font-bold text-primary">{stats.activas}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Vendidas</p>
          <p className="text-2xl font-bold text-green-600">{stats.vendidas}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Rentadas</p>
          <p className="text-2xl font-bold text-blue-600">{stats.rentadas}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros:</span>
        </div>
        
        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos los agentes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los agentes</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.agent_id} value={agent.agent_id}>
                {agent.profiles?.name || 'Sin nombre'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="activa">Activa</SelectItem>
            <SelectItem value="vendida">Vendida</SelectItem>
            <SelectItem value="rentada">Rentada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla de propiedades */}
      {filteredProperties.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No hay propiedades que coincidan con los filtros
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Destacada</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProperties.map((property) => (
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
                        <p className="font-medium">{property.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {property.municipality}, {property.state}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {property.profiles?.name || 'Sin asignar'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{property.type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatPrice(property.price)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={property.status === 'activa' ? 'default' : 'secondary'}
                    >
                      {property.status}
                    </Badge>
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
                    {new Date(property.created_at).toLocaleDateString('es-MX')}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/propiedad/${property.id}`)}
                        title="Ver propiedad"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenAssignDialog(property)}
                        title="Reasignar agente"
                      >
                        <UserCog className="h-4 w-4 text-primary" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog de asignación */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reasignar Propiedad a Agente</DialogTitle>
            <DialogDescription>
              Selecciona el agente que se hará cargo de esta propiedad
            </DialogDescription>
          </DialogHeader>

          {selectedProperty && (
            <div className="space-y-4 py-4">
              {/* Información de la propiedad */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-semibold mb-1">{selectedProperty.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedProperty.municipality}, {selectedProperty.state}
                </p>
                <p className="text-sm font-medium mt-2">
                  {formatPrice(selectedProperty.price)}
                </p>
              </div>

              {/* Agente actual */}
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Agente actual:</span>{' '}
                  {selectedProperty.profiles?.name || 'Sin asignar'}
                </AlertDescription>
              </Alert>

              {/* Selector de nuevo agente */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Nuevo Agente Asignado</label>
                <Select value={selectedNewAgent} onValueChange={setSelectedNewAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.agent_id} value={agent.agent_id}>
                        {agent.profiles?.name || 'Sin nombre'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  El agente asignado será responsable de gestionar esta propiedad y recibirá
                  las notificaciones de leads y mensajes relacionados.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assigning}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAssignProperty}
              disabled={assigning || !selectedNewAgent || selectedNewAgent === selectedProperty?.agent_id}
            >
              {assigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reasignando...
                </>
              ) : (
                <>
                  <UserCog className="mr-2 h-4 w-4" />
                  Reasignar Propiedad
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeaturePropertyDialog
        property={featureProperty}
        open={!!featureProperty}
        onOpenChange={(open) => !open && setFeatureProperty(null)}
        onSuccess={() => {
          fetchProperties();
          fetchFeaturedProperties();
        }}
        subscriptionInfo={subscriptionInfo}
      />
    </div>
  );
};
