import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, TrendingUp, TrendingDown, RefreshCw, Shield, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionChange {
  id: string;
  user_id: string;
  previous_plan_id: string | null;
  new_plan_id: string;
  previous_billing_cycle: string | null;
  new_billing_cycle: string;
  changed_at: string;
  change_type: string;
  prorated_amount: number | null;
  metadata: Record<string, unknown> | null;
  profiles?: {
    name: string;
  };
}

interface Stats {
  totalChanges: number;
  upgradesCount: number;
  downgradesCount: number;
  bypassedCount: number;
  changesLast30Days: number;
}

const AdminSubscriptionChanges = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [changes, setChanges] = useState<SubscriptionChange[]>([]);
  const [filteredChanges, setFilteredChanges] = useState<SubscriptionChange[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalChanges: 0,
    upgradesCount: 0,
    downgradesCount: 0,
    bypassedCount: 0,
    changesLast30Days: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBypassed, setFilterBypassed] = useState<string>('all');

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchChanges();
    }
  }, [isAdmin]);

  useEffect(() => {
    applyFilters();
  }, [changes, searchTerm, filterType, filterBypassed]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('has_admin_access' as unknown as "has_admin_access", { user_uuid: user.id });

      if (error) throw error;

      if (!data) {
        toast({
          title: 'Acceso denegado',
          description: 'No tienes permisos para acceder a esta página',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/');
    }
  };

  const fetchChanges = async () => {
    try {
      setLoading(true);

      // Fetch subscription changes
      const { data: changesData, error: changesError } = await supabase
        .from('subscription_changes')
        .select('*')
        .order('changed_at', { ascending: false });

      if (changesError) throw changesError;

      // Fetch user profiles for all unique user IDs
      if (changesData && changesData.length > 0) {
        const userIds = [...new Set(changesData.map(c => c.user_id))];
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        // Map profiles to changes
        const profilesMap = new Map(profilesData?.map(p => [p.id, p.name]) || []);
        const changesWithProfiles = changesData.map(change => ({
          ...change,
          profiles: { name: profilesMap.get(change.user_id) || 'Usuario desconocido' }
        }));

        setChanges(changesWithProfiles);
        calculateStats(changesWithProfiles);
      } else {
        setChanges([]);
        calculateStats([]);
      }
    } catch (error) {
      console.error('Error fetching changes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los cambios de suscripción',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: SubscriptionChange[]) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    const stats = {
      totalChanges: data.length,
      upgradesCount: data.filter(c => c.change_type === 'upgrade').length,
      downgradesCount: data.filter(c => c.change_type === 'downgrade').length,
      bypassedCount: data.filter(c => c.metadata?.bypassed_cooldown).length,
      changesLast30Days: data.filter(c => new Date(c.changed_at) >= thirtyDaysAgo).length,
    };

    setStats(stats);
  };

  const applyFilters = () => {
    let filtered = [...changes];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(change => 
        change.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        change.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        change.metadata?.previous_plan_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        change.metadata?.new_plan_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(change => change.change_type === filterType);
    }

    // Bypassed filter
    if (filterBypassed === 'bypassed') {
      filtered = filtered.filter(change => change.metadata?.bypassed_cooldown);
    } else if (filterBypassed === 'normal') {
      filtered = filtered.filter(change => !change.metadata?.bypassed_cooldown);
    }

    setFilteredChanges(filtered);
  };

  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case 'upgrade':
        return (
          <Badge className="bg-green-600">
            <TrendingUp className="h-3 w-3 mr-1" />
            Upgrade
          </Badge>
        );
      case 'downgrade':
        return (
          <Badge variant="secondary">
            <TrendingDown className="h-3 w-3 mr-1" />
            Downgrade
          </Badge>
        );
      case 'cycle_change':
        return (
          <Badge variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" />
            Cambio de ciclo
          </Badge>
        );
      default:
        return <Badge>{type}</Badge>;
    }
  };

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8 mt-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Panel de Administración</h1>
            <p className="text-muted-foreground">Auditoría de cambios de suscripción</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Cambios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalChanges}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Upgrades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.upgradesCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Downgrades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{stats.downgradesCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bypass Realizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.bypassedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Últimos 30 días
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.changesLast30Days}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Refina la búsqueda de cambios de suscripción</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Input
                  placeholder="Buscar por usuario o plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de cambio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="upgrade">Upgrades</SelectItem>
                  <SelectItem value="downgrade">Downgrades</SelectItem>
                  <SelectItem value="cycle_change">Cambios de ciclo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterBypassed} onValueChange={setFilterBypassed}>
                <SelectTrigger>
                  <SelectValue placeholder="Bypass de cooldown" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="bypassed">Solo bypass</SelectItem>
                  <SelectItem value="normal">Sin bypass</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {filteredChanges.length} de {changes.length} cambios
              </p>
              <Button onClick={fetchChanges} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Changes Table */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Cambios</CardTitle>
            <CardDescription>
              Todos los cambios de plan registrados en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Plan Anterior</TableHead>
                    <TableHead>Plan Nuevo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChanges.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No se encontraron cambios con los filtros aplicados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredChanges.map((change) => (
                      <TableRow key={change.id}>
                        <TableCell className="font-medium">
                          {format(new Date(change.changed_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{change.profiles?.name || 'Usuario'}</span>
                            <span className="text-xs text-muted-foreground">
                              {change.user_id.substring(0, 8)}...
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {change.metadata?.previous_plan_name || 'N/A'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {change.previous_billing_cycle && 
                                (change.previous_billing_cycle === 'yearly' ? 'Anual' : 'Mensual')
                              }
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {change.metadata?.new_plan_name || 'N/A'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {change.new_billing_cycle === 'yearly' ? 'Anual' : 'Mensual'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getChangeTypeBadge(change.change_type)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {change.metadata?.bypassed_cooldown && (
                              <Badge variant="outline" className="border-purple-500 text-purple-700">
                                <Shield className="h-3 w-3 mr-1" />
                                Bypass
                              </Badge>
                            )}
                            {change.metadata?.changed_by_admin && (
                              <Badge variant="outline" className="border-amber-500 text-amber-700">
                                <Users className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSubscriptionChanges;
