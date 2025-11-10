import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, History, Filter, TrendingUp, Users, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RoleAuditEntry {
  id: string;
  user_id: string;
  user_name: string;
  role: string;
  granted_at: string;
  granted_by: string;
  granted_by_name: string;
}

interface AuditStats {
  total_promotions: number;
  super_admin_count: number;
  moderator_count: number;
  recent_promotions: number;
}

const AdminRoleAudit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, loading } = useAdminCheck();
  const { toast } = useToast();

  const [auditEntries, setAuditEntries] = useState<RoleAuditEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<RoleAuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total_promotions: 0,
    super_admin_count: 0,
    moderator_count: 0,
    recent_promotions: 0,
  });
  const [loadingData, setLoadingData] = useState(true);

  // Filtros
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      navigate("/");
    }
  }, [isSuperAdmin, loading, navigate]);

  useEffect(() => {
    if (isSuperAdmin && user) {
      fetchAuditData();
    }
  }, [isSuperAdmin, user]);

  useEffect(() => {
    applyFilters();
  }, [auditEntries, startDate, endDate, roleFilter, searchTerm]);

  const fetchAuditData = async () => {
    try {
      setLoadingData(true);

      // Obtener todos los registros de user_roles (solo roles administrativos)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .in('role', ['super_admin', 'moderator'])
        .order('granted_at', { ascending: false });

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) {
        setAuditEntries([]);
        setLoadingData(false);
        return;
      }

      // Obtener información de usuarios (promovidos)
      const userIds = rolesData.map(r => r.user_id);
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      if (usersError) throw usersError;

      // Obtener información de quienes otorgaron roles
      const granterIds = rolesData
        .map(r => r.granted_by)
        .filter(id => id !== null);

      const { data: grantersData, error: grantersError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', granterIds);

      if (grantersError) throw grantersError;

      // Construir entradas de auditoría
      const entries: RoleAuditEntry[] = rolesData.map(role => {
        const userProfile = usersData?.find(u => u.id === role.user_id);
        const granterProfile = grantersData?.find(g => g.id === role.granted_by);

        return {
          id: role.id,
          user_id: role.user_id,
          user_name: userProfile?.name || 'Usuario desconocido',
          role: role.role,
          granted_at: role.granted_at,
          granted_by: role.granted_by || 'Sistema',
          granted_by_name: role.granted_by ? (granterProfile?.name || 'Admin') : 'Sistema',
        };
      });

      setAuditEntries(entries);

      // Calcular estadísticas
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      setStats({
        total_promotions: entries.length,
        super_admin_count: entries.filter(e => e.role === 'super_admin').length,
        moderator_count: entries.filter(e => e.role === 'moderator').length,
        recent_promotions: entries.filter(e => new Date(e.granted_at) >= last30Days).length,
      });

    } catch (error) {
      console.error('Error fetching audit data:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar el historial de auditoría',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...auditEntries];

    // Filtro por fecha de inicio
    if (startDate) {
      filtered = filtered.filter(entry => 
        new Date(entry.granted_at) >= new Date(startDate)
      );
    }

    // Filtro por fecha de fin
    if (endDate) {
      filtered = filtered.filter(entry => 
        new Date(entry.granted_at) <= new Date(endDate)
      );
    }

    // Filtro por rol
    if (roleFilter !== 'all') {
      filtered = filtered.filter(entry => entry.role === roleFilter);
    }

    // Filtro por búsqueda de texto
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.user_name.toLowerCase().includes(search) ||
        entry.granted_by_name.toLowerCase().includes(search)
      );
    }

    setFilteredEntries(filtered);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Badge className="bg-purple-600">Super Admin</Badge>;
      case 'moderator':
        return <Badge variant="secondary">Moderador</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setRoleFilter("all");
    setSearchTerm("");
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Cargando auditoría...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <History className="h-8 w-8" />
            Auditoría de Roles Administrativos
          </h1>
          <p className="text-muted-foreground mt-2">
            Historial completo de promociones y cambios de roles
          </p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total de Promociones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_promotions}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-600" />
                Super Admins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.super_admin_count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Moderadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.moderator_count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Últimos 30 Días
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.recent_promotions}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="startDate">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Fecha Inicio
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="endDate">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Fecha Fin
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="roleFilter">Tipo de Rol</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="moderator">Moderador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="search">Buscar Usuario</Label>
                <Input
                  id="search"
                  type="text"
                  placeholder="Nombre del usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={clearFilters}>
                Limpiar Filtros
              </Button>
              <Button variant="outline" onClick={fetchAuditData}>
                <History className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
            </div>

            {(startDate || endDate || roleFilter !== 'all' || searchTerm) && (
              <Alert>
                <AlertDescription>
                  Mostrando {filteredEntries.length} de {auditEntries.length} registros
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Tabla de auditoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Promociones ({filteredEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredEntries.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No se encontraron registros con los filtros aplicados.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario Promovido</TableHead>
                      <TableHead>Rol Otorgado</TableHead>
                      <TableHead>Fecha de Promoción</TableHead>
                      <TableHead>Promovido Por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.user_name}</p>
                            <p className="text-xs text-muted-foreground">ID: {entry.user_id.slice(0, 8)}...</p>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(entry.role)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {new Date(entry.granted_at).toLocaleDateString('es-MX', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.granted_at).toLocaleTimeString('es-MX', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{entry.granted_by_name}</p>
                            {entry.granted_by !== 'Sistema' && (
                              <p className="text-xs text-muted-foreground">
                                {entry.granted_by === user?.id ? '(Tú)' : ''}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminRoleAudit;
