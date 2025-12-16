import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  ShieldCheck,
  Building2,
  Home,
  CheckCircle,
  XCircle,
  Phone,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Trash2,
  UserCog,
  KeyRound,
  Mail,
  Calendar,
  CreditCard,
  Building,
  FileText,
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
  last_sign_in: string | null;
  email_confirmed: boolean;
  property_count: number;
  active_property_count: number;
  subscription: {
    status: string;
    billing_cycle: string;
    current_period_end: string;
    plan_name: string;
    plan_display_name: string;
  } | null;
}

interface Metrics {
  total: number;
  agents: number;
  agencies: number;
  suspended: number;
  verified: number;
  phoneVerified: number;
  withSubscription: number;
  withProperties: number;
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
  const [planFilter, setPlanFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Bulk selection
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  // Dialogs
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null });
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null });
  const [selectedRole, setSelectedRole] = useState('');
  const [profileDialog, setProfileDialog] = useState<{ open: boolean; user: UserData | null }>({ open: false, user: null });
  const [bulkDialog, setBulkDialog] = useState<{ open: boolean; action: string }>({ open: false, action: '' });

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
    }
  }, [adminLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, page, search, roleFilter, statusFilter, verifiedFilter, planFilter, dateFrom, dateTo]);

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
          planFilter: planFilter !== 'all' ? planFilter : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });

      if (response.error) throw response.error;

      const data = response.data;
      setUsers(data.users || []);
      setMetrics(data.metrics || null);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setSelectedUsers(new Set());
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

  const handleBulkAction = async (action: string) => {
    if (selectedUsers.size === 0) return;
    
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await supabase.functions.invoke('admin-user-action', {
        body: { 
          action: `bulk-${action}`, 
          userIds: Array.from(selectedUsers),
          reason: suspendReason || undefined,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      toast.success(response.data?.message || 'Acción completada');
      fetchUsers();
    } catch (error: any) {
      console.error('Error performing bulk action:', error);
      toast.error(error.message || 'Error al realizar la acción');
    } finally {
      setActionLoading(false);
      setBulkDialog({ open: false, action: '' });
      setSuspendReason('');
    }
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const toggleSelectUser = (userId: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUsers(newSet);
  };

  const getRoleBadge = (role: string) => {
    const config = ROLE_CONFIG[role] || ROLE_CONFIG.buyer;
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

  const getSubscriptionBadge = (sub: UserData['subscription']) => {
    if (!sub) return <span className="text-muted-foreground text-sm">Sin plan</span>;
    const statusColors: Record<string, string> = {
      active: 'text-green-600',
      trialing: 'text-blue-600',
      past_due: 'text-orange-600',
      canceled: 'text-red-600',
      incomplete: 'text-yellow-600',
    };
    return (
      <Badge variant="outline" className={statusColors[sub.status] || ''}>
        {sub.plan_display_name || sub.plan_name}
      </Badge>
    );
  };

  if (adminLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <h1 className="text-xl md:text-2xl font-bold">Gestión de Usuarios</h1>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{metrics.total}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-green-600">{metrics.agents}</div><p className="text-xs text-muted-foreground">Agentes</p></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-blue-600">{metrics.agencies}</div><p className="text-xs text-muted-foreground">Inmobiliarias</p></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-orange-600">{metrics.suspended}</div><p className="text-xs text-muted-foreground">Suspendidos</p></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-purple-600">{metrics.verified}</div><p className="text-xs text-muted-foreground">KYC</p></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-cyan-600">{metrics.phoneVerified}</div><p className="text-xs text-muted-foreground">Tel.</p></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-emerald-600">{metrics.withSubscription}</div><p className="text-xs text-muted-foreground">Con Plan</p></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-amber-600">{metrics.withProperties}</div><p className="text-xs text-muted-foreground">Con Props</p></CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Rol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="moderator">Moderador</SelectItem>
                <SelectItem value="agency">Inmobiliaria</SelectItem>
                <SelectItem value="agent">Agente</SelectItem>
                <SelectItem value="developer">Desarrolladora</SelectItem>
                <SelectItem value="buyer">Comprador</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-32"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="suspended">Suspendidos</SelectItem>
                <SelectItem value="banned">Baneados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={verifiedFilter} onValueChange={(v) => { setVerifiedFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Verificación" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="kyc_verified">KYC</SelectItem>
                <SelectItem value="phone_verified">Teléfono</SelectItem>
                <SelectItem value="not_verified">Sin verificar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos planes</SelectItem>
                <SelectItem value="no_subscription">Sin plan</SelectItem>
                <SelectItem value="agente_trial">Trial</SelectItem>
                <SelectItem value="agente_basico">Básico</SelectItem>
                <SelectItem value="agente_pro">Pro</SelectItem>
                <SelectItem value="agente_premium">Premium</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-full md:w-40" placeholder="Desde" />
              <span className="text-muted-foreground">-</span>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-full md:w-40" placeholder="Hasta" />
            </div>
            {(dateFrom || dateTo || planFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setPlanFilter('all'); }}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Toolbar */}
      {selectedUsers.size > 0 && (
        <Card className="mb-4 border-primary">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="font-medium">{selectedUsers.size} usuarios seleccionados</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkDialog({ open: true, action: 'activate' })}>
                <UserCheck className="h-4 w-4 mr-1" /> Activar
              </Button>
              <Button variant="outline" size="sm" className="text-orange-600" onClick={() => setBulkDialog({ open: true, action: 'suspend' })}>
                <UserX className="h-4 w-4 mr-1" /> Suspender
              </Button>
              {isSuperAdmin && (
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => setBulkDialog({ open: true, action: 'delete' })}>
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedUsers(new Set())}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

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
              No se encontraron usuarios
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Props</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={selectedUsers.has(user.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedUsers.has(user.id)}
                        onCheckedChange={() => toggleSelectUser(user.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            {user.name || 'Sin nombre'}
                            {user.is_verified && <CheckCircle className="h-3 w-3 text-green-600" />}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            {user.email}
                            {!user.email_confirmed && <span className="text-orange-500 text-xs">(no verificado)</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.primaryRole)}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>{getSubscriptionBadge(user.subscription)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{user.active_property_count}</span>
                      <span className="text-muted-foreground">/{user.property_count}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(user.created_at), 'dd/MM/yy', { locale: es })}
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
                            <Eye className="h-4 w-4 mr-2" /> Ver perfil completo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedRole(user.primaryRole); setRoleDialog({ open: true, user }); }}>
                            <UserCog className="h-4 w-4 mr-2" /> Cambiar rol
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAction('reset-password', user.id)}>
                            <KeyRound className="h-4 w-4 mr-2" /> Forzar reset contraseña
                          </DropdownMenuItem>
                          {!user.email_confirmed && (
                            <DropdownMenuItem onClick={() => handleAction('resend-verification', user.id)}>
                              <Mail className="h-4 w-4 mr-2" /> Reenviar verificación
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {user.status === 'active' ? (
                            <DropdownMenuItem onClick={() => setSuspendDialog({ open: true, user })} className="text-orange-600">
                              <UserX className="h-4 w-4 mr-2" /> Suspender
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleAction('activate', user.id)} className="text-green-600">
                              <UserCheck className="h-4 w-4 mr-2" /> Reactivar
                            </DropdownMenuItem>
                          )}
                          {isSuperAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteDialog({ open: true, user })} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar cuenta
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
            {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} de {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>
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
            <DialogDescription>¿Suspender a {suspendDialog.user?.name}?</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Razón de la suspensión (opcional)" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog({ open: false, user: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={() => handleAction('suspend', suspendDialog.user!.id, { reason: suspendReason })} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Suspender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, user: open ? deleteDialog.user : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto eliminará permanentemente a {deleteDialog.user?.name} ({deleteDialog.user?.email}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => handleAction('delete', deleteDialog.user!.id)} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Dialog */}
      <AlertDialog open={bulkDialog.open} onOpenChange={(open) => setBulkDialog({ open, action: open ? bulkDialog.action : '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkDialog.action === 'delete' ? '¿Eliminar usuarios?' : 
               bulkDialog.action === 'suspend' ? '¿Suspender usuarios?' : '¿Activar usuarios?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción afectará a {selectedUsers.size} usuarios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {bulkDialog.action === 'suspend' && (
            <Textarea placeholder="Razón (opcional)" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className={bulkDialog.action === 'delete' ? 'bg-destructive' : ''} 
              onClick={() => handleBulkAction(bulkDialog.action)}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Role Dialog */}
      <Dialog open={roleDialog.open} onOpenChange={(open) => setRoleDialog({ open, user: open ? roleDialog.user : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Rol</DialogTitle>
            <DialogDescription>Roles de {roleDialog.user?.name}: {roleDialog.user?.roles.join(', ')}</DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog({ open: false, user: null })}>Cancelar</Button>
            <Button onClick={() => handleAction('change-role', roleDialog.user!.id, { newRole: selectedRole })} disabled={actionLoading || !selectedRole}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Dialog - Enhanced */}
      <Dialog open={profileDialog.open} onOpenChange={(open) => setProfileDialog({ open, user: open ? profileDialog.user : null })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Perfil de Usuario</DialogTitle>
          </DialogHeader>
          {profileDialog.user && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="subscription">Suscripción</TabsTrigger>
                <TabsTrigger value="activity">Actividad</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
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
                  <div><p className="text-muted-foreground">Teléfono</p><p>{profileDialog.user.phone || '—'}</p></div>
                  <div><p className="text-muted-foreground">Ubicación</p><p>{[profileDialog.user.city, profileDialog.user.state].filter(Boolean).join(', ') || '—'}</p></div>
                  <div><p className="text-muted-foreground">Estado</p>{getStatusBadge(profileDialog.user.status)}</div>
                  <div><p className="text-muted-foreground">Roles</p><div className="flex flex-wrap gap-1 mt-1">{profileDialog.user.roles.map(r => <Badge key={r} variant="outline" className="text-xs">{ROLE_CONFIG[r]?.label || r}</Badge>)}</div></div>
                  <div><p className="text-muted-foreground">Registro</p><p>{format(new Date(profileDialog.user.created_at), 'dd MMM yyyy HH:mm', { locale: es })}</p></div>
                  <div>
                    <p className="text-muted-foreground">Verificación</p>
                    <div className="flex gap-2 mt-1">
                      {profileDialog.user.email_confirmed ? <Badge variant="outline" className="text-green-600"><Mail className="h-3 w-3 mr-1" />Email</Badge> : <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" />Email</Badge>}
                      {profileDialog.user.is_verified ? <Badge variant="outline" className="text-green-600"><CheckCircle className="h-3 w-3 mr-1" />KYC</Badge> : null}
                      {profileDialog.user.phone_verified ? <Badge variant="outline" className="text-blue-600"><Phone className="h-3 w-3 mr-1" />Tel</Badge> : null}
                    </div>
                  </div>
                </div>

                {profileDialog.user.status === 'suspended' && profileDialog.user.suspended_reason && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Suspendido</p>
                    <p className="text-sm text-orange-700 dark:text-orange-300">{profileDialog.user.suspended_reason}</p>
                    {profileDialog.user.suspended_at && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        {format(new Date(profileDialog.user.suspended_at), 'dd MMM yyyy HH:mm', { locale: es })}
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="subscription" className="space-y-4">
                {profileDialog.user.subscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 border rounded-lg">
                      <CreditCard className="h-8 w-8 text-primary" />
                      <div>
                        <h4 className="font-semibold">{profileDialog.user.subscription.plan_display_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {profileDialog.user.subscription.billing_cycle === 'yearly' ? 'Anual' : 'Mensual'} • 
                          Estado: <span className="capitalize">{profileDialog.user.subscription.status}</span>
                        </p>
                      </div>
                    </div>
                    {profileDialog.user.subscription.current_period_end && (
                      <p className="text-sm text-muted-foreground">
                        Próxima renovación: {format(new Date(profileDialog.user.subscription.current_period_end), 'dd MMM yyyy', { locale: es })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Sin suscripción activa</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <Building className="h-6 w-6 text-primary mb-2" />
                    <p className="text-2xl font-bold">{profileDialog.user.active_property_count}</p>
                    <p className="text-sm text-muted-foreground">Propiedades activas</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <FileText className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-2xl font-bold">{profileDialog.user.property_count}</p>
                    <p className="text-sm text-muted-foreground">Total propiedades</p>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="text-muted-foreground">Último acceso</p>
                  <p>{profileDialog.user.last_sign_in ? format(new Date(profileDialog.user.last_sign_in), 'dd MMM yyyy HH:mm', { locale: es }) : 'Nunca'}</p>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
