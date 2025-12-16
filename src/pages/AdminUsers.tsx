import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  ShieldCheck,
  Building2,
  Home,
  Ban,
  CheckCircle,
  XCircle,
  Phone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Trash2,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface UserData {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  is_verified: boolean;
  phone_verified: boolean;
  status: 'active' | 'suspended' | 'banned';
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  roles: string[];
  primaryRole: string;
}

interface Metrics {
  total: number;
  agents: number;
  agencies: number;
  suspended: number;
  verified: number;
  phoneVerified: number;
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  super_admin: { label: 'Super Admin', icon: ShieldCheck, color: 'bg-red-500' },
  admin: { label: 'Admin', icon: ShieldCheck, color: 'bg-orange-500' },
  moderator: { label: 'Moderador', icon: UserCog, color: 'bg-purple-500' },
  agency: { label: 'Inmobiliaria', icon: Building2, color: 'bg-blue-500' },
  agent: { label: 'Agente', icon: Home, color: 'bg-green-500' },
  developer: { label: 'Desarrolladora', icon: Building2, color: 'bg-cyan-500' },
  buyer: { label: 'Comprador', icon: Users, color: 'bg-gray-500' },
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  suspended: { label: 'Suspendido', variant: 'secondary' },
  banned: { label: 'Baneado', variant: 'destructive' },
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, loading: adminLoading } = useAdminCheck();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Dialogs
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null });
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null });
  const [selectedRole, setSelectedRole] = useState('');
  const [profileDialog, setProfileDialog] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null });

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
    }
  }, [adminLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, page, search, roleFilter, statusFilter, verifiedFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await supabase.functions.invoke('admin-list-users', {
        body: {
          page,
          pageSize,
          search: search.trim() || undefined,
          roleFilter: roleFilter !== 'all' ? roleFilter : undefined,
          statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
          verifiedFilter: verifiedFilter !== 'all' ? verifiedFilter : undefined,
        },
      });

      if (response.error) throw response.error;

      const data = response.data;
      setUsers(data.users || []);
      setMetrics(data.metrics || null);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, userId: string, params?: any) => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await supabase.functions.invoke('admin-user-action', {
        body: { action, userId, ...params },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast.success(response.data?.message || 'Acción completada');
      fetchUsers();
    } catch (error: any) {
      console.error('Error performing action:', error);
      toast.error(error.message || 'Error al realizar la acción');
    } finally {
      setActionLoading(false);
      setSuspendDialog({ open: false, user: null });
      setDeleteDialog({ open: false, user: null });
      setRoleDialog({ open: false, user: null });
      setSuspendReason('');
      setSelectedRole('');
    }
  };

  const getRoleBadge = (role: string) => {
    const config = ROLE_CONFIG[role] || ROLE_CONFIG.buyer;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className="gap-1">
        <span className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (adminLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{metrics.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{metrics.agents}</div>
              <p className="text-xs text-muted-foreground">Agentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{metrics.agencies}</div>
              <p className="text-xs text-muted-foreground">Inmobiliarias</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">{metrics.suspended}</div>
              <p className="text-xs text-muted-foreground">Suspendidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-purple-600">{metrics.verified}</div>
              <p className="text-xs text-muted-foreground">KYC Verificado</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-cyan-600">{metrics.phoneVerified}</div>
              <p className="text-xs text-muted-foreground">Tel. Verificado</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderador</SelectItem>
                <SelectItem value="agency">Inmobiliaria</SelectItem>
                <SelectItem value="agent">Agente</SelectItem>
                <SelectItem value="developer">Desarrolladora</SelectItem>
                <SelectItem value="buyer">Comprador</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="suspended">Suspendidos</SelectItem>
                <SelectItem value="banned">Baneados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={verifiedFilter} onValueChange={(v) => { setVerifiedFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Verificación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="kyc_verified">KYC Verificado</SelectItem>
                <SelectItem value="phone_verified">Tel. Verificado</SelectItem>
                <SelectItem value="not_verified">Sin verificar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No se encontraron usuarios con los filtros seleccionados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Verificación</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.name || 'Sin nombre'}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getRoleBadge(user.primaryRole)}
                        {user.roles.length > 1 && (
                          <Badge variant="outline" className="text-xs">
                            +{user.roles.length - 1}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {user.is_verified && (
                          <Badge variant="outline" className="gap-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            KYC
                          </Badge>
                        )}
                        {user.phone_verified && (
                          <Badge variant="outline" className="gap-1 text-blue-600">
                            <Phone className="h-3 w-3" />
                            Tel
                          </Badge>
                        )}
                        {!user.is_verified && !user.phone_verified && (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(user.created_at), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={actionLoading}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setProfileDialog({ open: true, user })}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedRole(user.primaryRole);
                            setRoleDialog({ open: true, user });
                          }}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Cambiar rol
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status === 'active' ? (
                            <DropdownMenuItem 
                              onClick={() => setSuspendDialog({ open: true, user })}
                              className="text-orange-600"
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Suspender
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              onClick={() => handleAction('activate', user.id)}
                              className="text-green-600"
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Reactivar
                            </DropdownMenuItem>
                          )}
                          {isSuperAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => setDeleteDialog({ open: true, user })}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar cuenta
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} de {total} usuarios
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Suspend Dialog */}
      <Dialog open={suspendDialog.open} onOpenChange={(open) => setSuspendDialog({ open, user: open ? suspendDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender Usuario</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de suspender a {suspendDialog.user?.name}? El usuario no podrá acceder a su cuenta.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Razón de la suspensión (opcional)"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog({ open: false, user: null })}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction('suspend', suspendDialog.user!.id, { reason: suspendReason })}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Suspender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: open ? deleteDialog.user : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la cuenta de {deleteDialog.user?.name} ({deleteDialog.user?.email}). 
              Esto incluye todas sus propiedades, mensajes y datos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleAction('delete', deleteDialog.user!.id)}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Role Dialog */}
      <Dialog open={roleDialog.open} onOpenChange={(open) => setRoleDialog({ open, user: open ? roleDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Rol</DialogTitle>
            <DialogDescription>
              Roles actuales de {roleDialog.user?.name}: {roleDialog.user?.roles.join(', ')}
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buyer">Comprador</SelectItem>
              <SelectItem value="agent">Agente</SelectItem>
              <SelectItem value="agency">Inmobiliaria</SelectItem>
              <SelectItem value="developer">Desarrolladora</SelectItem>
              {isSuperAdmin && (
                <>
                  <SelectItem value="moderator">Moderador</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {roleDialog.user?.roles.includes(selectedRole) 
              ? `Se eliminará el rol "${selectedRole}" del usuario`
              : `Se agregará el rol "${selectedRole}" al usuario`
            }
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog({ open: false, user: null })}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleAction('change-role', roleDialog.user!.id, { newRole: selectedRole })}
              disabled={actionLoading || !selectedRole}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={profileDialog.open} onOpenChange={(open) => setProfileDialog({ open, user: open ? profileDialog.user : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Perfil de Usuario</DialogTitle>
          </DialogHeader>
          {profileDialog.user && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profileDialog.user.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">{profileDialog.user.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{profileDialog.user.name}</h3>
                  <p className="text-muted-foreground">{profileDialog.user.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Teléfono</p>
                  <p>{profileDialog.user.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ubicación</p>
                  <p>{[profileDialog.user.city, profileDialog.user.state].filter(Boolean).join(', ') || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  {getStatusBadge(profileDialog.user.status)}
                </div>
                <div>
                  <p className="text-muted-foreground">Roles</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profileDialog.user.roles.map(role => (
                      <Badge key={role} variant="outline" className="text-xs">
                        {ROLE_CONFIG[role]?.label || role}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">Registro</p>
                  <p>{format(new Date(profileDialog.user.created_at), 'dd MMM yyyy HH:mm', { locale: es })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Verificación</p>
                  <div className="flex gap-2 mt-1">
                    {profileDialog.user.is_verified ? (
                      <Badge variant="outline" className="text-green-600"><CheckCircle className="h-3 w-3 mr-1" />KYC</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" />Sin KYC</Badge>
                    )}
                    {profileDialog.user.phone_verified ? (
                      <Badge variant="outline" className="text-blue-600"><Phone className="h-3 w-3 mr-1" />Tel</Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              {profileDialog.user.status === 'suspended' && profileDialog.user.suspended_reason && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Razón de suspensión:</p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">{profileDialog.user.suspended_reason}</p>
                  {profileDialog.user.suspended_at && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      Suspendido el {format(new Date(profileDialog.user.suspended_at), 'dd MMM yyyy HH:mm', { locale: es })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
