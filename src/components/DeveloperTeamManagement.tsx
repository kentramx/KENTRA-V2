import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMonitoring } from '@/lib/monitoring';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus, Trash2, Clock, XCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DeveloperTeamManagementProps {
  developerId: string;
  subscriptionInfo: any;
}

export const DeveloperTeamManagement = ({ developerId, subscriptionInfo }: DeveloperTeamManagementProps) => {
  const { toast } = useToast();
  const { error: logError, warn, captureException } = useMonitoring();
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'sales' | 'manager' | 'admin'>('sales');
  const [inviting, setInviting] = useState(false);
  const [developerName, setDeveloperName] = useState('');

  const maxAgents = subscriptionInfo?.features?.limits?.max_agents || 2;

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
    fetchDeveloperName();
  }, [developerId]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('developer_team')
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            phone
          )
        `)
        .eq('developer_id', developerId)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      logError('Error fetching developer team', {
        component: 'DeveloperTeamManagement',
        developerId,
        error,
      });
      captureException(error as Error, {
        component: 'DeveloperTeamManagement',
        action: 'fetchMembers',
        developerId,
      });
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los miembros del equipo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('developer_invitations')
        .select('*')
        .eq('developer_id', developerId)
        .in('status', ['pending', 'accepted'])
        .order('invited_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      warn('Error fetching developer invitations', {
        component: 'DeveloperTeamManagement',
        developerId,
        error,
      });
    }
  };

  const fetchDeveloperName = async () => {
    try {
      const { data, error } = await supabase
        .from('developers')
        .select('name')
        .eq('id', developerId)
        .single();

      if (error) throw error;
      setDeveloperName(data?.name || '');
    } catch (error) {
      warn('Error fetching developer name', {
        component: 'DeveloperTeamManagement',
        developerId,
        error,
      });
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: 'Email inválido',
        description: 'Por favor ingresa un email válido',
        variant: 'destructive',
      });
      return;
    }

    const totalSlots = members.length + invitations.filter(inv => inv.status === 'pending' || inv.status === 'accepted').length;
    if (maxAgents !== -1 && totalSlots >= maxAgents) {
      toast({
        title: 'Límite alcanzado',
        description: `Has alcanzado el límite de ${maxAgents} miembros (incluyendo invitaciones pendientes). Mejora tu plan para agregar más.`,
        variant: 'destructive',
      });
      return;
    }

    setInviting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      // Crear invitación en la base de datos
      const { error: inviteError } = await supabase
        .from('developer_invitations')
        .insert({
          developer_id: developerId,
          email: inviteEmail,
          role: inviteRole,
          invited_by: user.id,
          status: 'pending',
        });

      if (inviteError) throw inviteError;

      // TODO: Llamar Edge Function para enviar email (send-developer-invitation)

      toast({
        title: '✅ Invitación enviada',
        description: `Se ha enviado una invitación a ${inviteEmail}`,
      });
      
      setInviteDialogOpen(false);
      setInviteEmail('');
      fetchInvitations();
    } catch (error: any) {
      logError('Error inviting team member', {
        component: 'DeveloperTeamManagement',
        developerId,
        inviteEmail,
        error,
      });
      captureException(error, {
        component: 'DeveloperTeamManagement',
        action: 'inviteMember',
        developerId,
      });
      toast({
        title: 'Error',
        description: error.message || 'No se pudo enviar la invitación',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string, email: string) => {
    if (!confirm(`¿Cancelar la invitación enviada a ${email}?`)) return;

    try {
      const { error } = await supabase
        .from('developer_invitations')
        .update({ status: 'rejected' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Invitación cancelada',
        description: `Se ha cancelado la invitación a ${email}`,
      });

      fetchInvitations();
    } catch (error) {
      logError('Error cancelling invitation', {
        component: 'DeveloperTeamManagement',
        invitationId,
        email,
        error,
      });
      captureException(error as Error, {
        component: 'DeveloperTeamManagement',
        action: 'cancelInvitation',
      });
      toast({
        title: 'Error',
        description: 'No se pudo cancelar la invitación',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`¿Remover a ${memberName} del equipo?`)) return;

    try {
      const { error } = await supabase
        .from('developer_team')
        .delete()
        .eq('developer_id', developerId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Miembro removido',
        description: `${memberName} ha sido removido del equipo`,
      });

      fetchMembers();
    } catch (error) {
      logError('Error removing team member', {
        component: 'DeveloperTeamManagement',
        developerId,
        error,
      });
      captureException(error as Error, {
        component: 'DeveloperTeamManagement',
        action: 'removeMember',
        developerId,
      });
      toast({
        title: 'Error',
        description: 'No se pudo remover al miembro',
        variant: 'destructive',
      });
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'manager': return 'Gerente';
      case 'sales': return 'Ventas';
      default: return role;
    }
  };

  const canAddMore = maxAgents === -1 || members.length < maxAgents;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con contador */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Equipo de Trabajo</h3>
          <p className="text-sm text-muted-foreground">
            {members.length} de {maxAgents === -1 ? 'ilimitados' : maxAgents} miembros
          </p>
        </div>
        <Button
          onClick={() => setInviteDialogOpen(true)}
          disabled={!canAddMore}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invitar Miembro
        </Button>
      </div>

      {/* Alerta si está cerca del límite */}
      {!canAddMore && maxAgents !== -1 && (
        <Alert>
          <AlertDescription>
            Has alcanzado el límite de miembros de tu plan. Mejora tu plan para agregar más miembros al equipo.
          </AlertDescription>
        </Alert>
      )}

      {/* Invitaciones pendientes */}
      {invitations.filter(inv => inv.status === 'pending').length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Invitaciones Pendientes</h4>
          <div className="space-y-2">
            {invitations.filter(inv => inv.status === 'pending').map((invitation) => (
              <Alert key={invitation.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invitado el {new Date(invitation.invited_at).toLocaleDateString('es-MX')} • 
                      Rol: {getRoleLabel(invitation.role)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancelInvitation(invitation.id, invitation.email)}
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Lista de miembros */}
      {members.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No hay miembros en tu equipo
          </p>
          <Button onClick={() => setInviteDialogOpen(true)}>
            Invitar primer miembro
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha de Ingreso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.profiles?.name || 'Sin nombre'}
                  </TableCell>
                  <TableCell>
                    {member.profiles?.phone || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getRoleLabel(member.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.status === 'active' ? 'default' : 'secondary'}
                    >
                      {member.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(member.joined_at).toLocaleDateString('es-MX')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMember(member.user_id, member.profiles?.name)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog de invitación */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Miembro al Equipo</DialogTitle>
            <DialogDescription>
              Envía una invitación por email para agregar un nuevo miembro a tu equipo de desarrolladora
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email del Miembro</Label>
              <Input
                id="email"
                type="email"
                placeholder="miembro@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Ventas</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Los vendedores pueden ver proyectos. Los gerentes pueden editar. Los administradores tienen control total.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              disabled={inviting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleInviteMember}
              disabled={inviting || !inviteEmail}
            >
              {inviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Invitación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
