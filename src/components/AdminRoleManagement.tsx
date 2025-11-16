import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, UserCog, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMonitoring } from '@/lib/monitoring';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  granted_at: string;
  granted_by: string;
}

interface AdminRoleManagementProps {
  currentUserId: string;
  isSuperAdmin: boolean;
}

export const AdminRoleManagement = ({ currentUserId, isSuperAdmin }: AdminRoleManagementProps) => {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const { toast } = useToast();
  const { error: logError, warn, captureException } = useMonitoring();

  const [targetEmail, setTargetEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('moderator');

  useEffect(() => {
    fetchAdminUsers();
  }, []);

  const fetchAdminUsers = async () => {
    try {
      // Obtener todos los usuarios con roles administrativos
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, granted_at, granted_by')
        .in('role', ['super_admin', 'moderator'] as any)
        .order('granted_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Obtener información de usuarios desde auth.users
      const userIds = rolesData?.map(r => r.user_id) || [];
      if (userIds.length === 0) {
        setAdminUsers([]);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Obtener emails (necesitamos usar RPC o edge function para acceder a auth.users)
      // Por ahora, construimos la lista con la info disponible
      const admins: AdminUser[] = rolesData?.map(role => {
        const profile = profilesData?.find(p => p.id === role.user_id);
        return {
          id: role.user_id,
          email: 'Email protegido', // No podemos acceder a auth.users directamente desde el cliente
          name: profile?.name || 'Usuario',
          role: role.role,
          granted_at: role.granted_at,
          granted_by: role.granted_by || 'Sistema',
        };
      }) || [];

      setAdminUsers(admins);
    } catch (error) {
      logError('Error fetching admin users', {
        component: 'AdminRoleManagement',
        error,
      });
      captureException(error as Error, {
        component: 'AdminRoleManagement',
        action: 'fetchAdminUsers',
      });
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios administrativos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteUser = async () => {
    if (!targetEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Ingresa el email del usuario',
        variant: 'destructive',
      });
      return;
    }

    if (!targetEmail.endsWith('@kentra.com.mx')) {
      toast({
        title: 'Error',
        description: 'Solo usuarios con email @kentra.com.mx pueden ser promovidos',
        variant: 'destructive',
      });
      return;
    }

    setPromoting(true);
    try {
      // Buscar usuario por email usando edge function
      const { data: searchResult, error: searchError } = await supabase.functions.invoke('get-user-by-email', {
        body: { email: targetEmail },
      });

      if (searchError || !searchResult?.found) {
        toast({
          title: 'Error',
          description: searchResult?.error || 'Usuario no encontrado',
          variant: 'destructive',
        });
        return;
      }

      const foundUser = searchResult.user;

      // Promover usando la función RPC
      const { error: promoteError } = await (supabase.rpc as any)('promote_user_to_admin', {
        target_user_id: foundUser.id,
        new_admin_role: selectedRole,
      });

      if (promoteError) throw promoteError;

      toast({
        title: '✅ Usuario promovido',
        description: `${foundUser.name} (${targetEmail}) ahora es ${getRoleLabel(selectedRole)}`,
      });

      setTargetEmail('');
      setSelectedRole('moderator');
      fetchAdminUsers();
    } catch (error: any) {
      logError('Error promoting user', {
        component: 'AdminRoleManagement',
        targetEmail,
        selectedRole,
        error,
      });
      captureException(error, {
        component: 'AdminRoleManagement',
        action: 'promoteUser',
        targetEmail,
        selectedRole,
      });
      toast({
        title: 'Error',
        description: error.message || 'No se pudo promover al usuario',
        variant: 'destructive',
      });
    } finally {
      setPromoting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'moderator':
        return 'Moderador';
      default:
        return role;
    }
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Solo Super Admins pueden gestionar roles administrativos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulario para promover usuarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Promover Usuario a Rol Administrativo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Solo usuarios con email <strong>@kentra.com.mx</strong> pueden ser promovidos a roles administrativos.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="userEmail">Email del Usuario (@kentra.com.mx)</Label>
              <Input
                id="userEmail"
                type="email"
                placeholder="usuario@kentra.com.mx"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                disabled={promoting}
              />
            </div>

            <div>
              <Label htmlFor="role">Rol Administrativo</Label>
              <Select
                value={selectedRole}
                onValueChange={(value: any) => setSelectedRole(value)}
                disabled={promoting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple-600" />
                      Super Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="moderator">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" />
                      Moderador
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handlePromoteUser} disabled={promoting}>
            {promoting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Promoviendo...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Promover Usuario
              </>
            )}
          </Button>

          <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
            <p className="font-semibold">Roles disponibles:</p>
            <ul className="space-y-1 ml-4">
              <li>
                <strong>Super Admin:</strong> Acceso total al sistema, gestión financiera, administración de usuarios y roles.
              </li>
              <li>
                <strong>Moderador:</strong> Moderación de contenido, soporte al cliente, sin acceso a datos financieros.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Lista de usuarios administrativos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Usuarios Administrativos ({adminUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adminUsers.length === 0 ? (
            <Alert>
              <AlertDescription>
                No hay usuarios administrativos registrados.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha de Asignación</TableHead>
                  <TableHead>Asignado Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{admin.name}</p>
                        <p className="text-sm text-muted-foreground">{admin.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(admin.role)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(admin.granted_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {admin.granted_by === currentUserId ? 'Tú' : 'Otro Super Admin'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
