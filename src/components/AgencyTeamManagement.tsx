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
import { Loader2, UserPlus, Trash2, Mail, Clock, XCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AgencyTeamManagementProps {
  agencyId: string;
  subscriptionInfo: any;
}

export const AgencyTeamManagement = ({ agencyId, subscriptionInfo }: AgencyTeamManagementProps) => {
  const { toast } = useToast();
  const { error: logError, warn, captureException } = useMonitoring();
  const [agents, setAgents] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'agent' | 'manager'>('agent');
  const [inviting, setInviting] = useState(false);
  const [agencyName, setAgencyName] = useState('');

  const maxAgents = subscriptionInfo?.features?.max_agents || 5;

  useEffect(() => {
    fetchAgents();
    fetchInvitations();
    fetchAgencyName();
  }, [agencyId]);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_agents')
        .select(`
          *,
          profiles:agent_id (
            id,
            name,
            email,
            phone
          )
        `)
        .eq('agency_id', agencyId)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      logError('Error fetching team agents', {
        component: 'AgencyTeamManagement',
        agencyId,
        error,
      });
      captureException(error as Error, {
        component: 'AgencyTeamManagement',
        action: 'fetchAgents',
        agencyId,
      });
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los agentes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_invitations')
        .select('*')
        .eq('agency_id', agencyId)
        .in('status', ['pending', 'accepted'])
        .order('invited_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      warn('Error fetching agency invitations', {
        component: 'AgencyTeamManagement',
        agencyId,
        error,
      });
    }
  };

  const fetchAgencyName = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', agencyId)
        .single();

      if (error) throw error;
      setAgencyName(data?.name || '');
    } catch (error) {
      warn('Error fetching agency name', {
        component: 'AgencyTeamManagement',
        agencyId,
        error,
      });
    }
  };

  const handleInviteAgent = async () => {
    if (!inviteEmail) return;

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: 'Email inválido',
        description: 'Por favor ingresa un email válido',
        variant: 'destructive',
      });
      return;
    }

    // Validar límite incluyendo agentes actuales + invitaciones pendientes/aceptadas
    const totalSlots = agents.length + invitations.filter(inv => inv.status === 'pending' || inv.status === 'accepted').length;
    if (totalSlots >= maxAgents) {
      toast({
        title: 'Límite alcanzado',
        description: `Has alcanzado el límite de ${maxAgents} agentes (incluyendo invitaciones pendientes). Mejora tu plan para agregar más.`,
        variant: 'destructive',
      });
      return;
    }

    setInviting(true);
    try {
      // Obtener datos del usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      // Llamar al Edge Function para enviar la invitación
      const { data, error } = await supabase.functions.invoke('send-agent-invitation', {
        body: {
          agencyId,
          email: inviteEmail,
          role: inviteRole,
          agencyName: agencyName,
          inviterName: profile?.name || 'Administrador',
        },
      });

      if (error) throw error;

      toast({
        title: '✅ Invitación enviada',
        description: `Se ha enviado una invitación a ${inviteEmail}`,
      });
      
      setInviteDialogOpen(false);
      setInviteEmail('');
      fetchInvitations(); // Recargar invitaciones
    } catch (error: any) {
      logError('Error inviting agent to agency', {
        component: 'AgencyTeamManagement',
        agencyId,
        inviteEmail,
        error,
      });
      captureException(error, {
        component: 'AgencyTeamManagement',
        action: 'inviteAgent',
        agencyId,
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
        .from('agency_invitations')
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
        component: 'AgencyTeamManagement',
        invitationId,
        email,
        error,
      });
      captureException(error as Error, {
        component: 'AgencyTeamManagement',
        action: 'cancelInvitation',
      });
      toast({
        title: 'Error',
        description: 'No se pudo cancelar la invitación',
        variant: 'destructive',
      });
    }
  };

  const handleResendInvitation = async (invitation: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      // Reenviar invitación
      const { error } = await supabase.functions.invoke('send-agent-invitation', {
        body: {
          agencyId,
          email: invitation.email,
          role: invitation.role,
          agencyName: agencyName,
          inviterName: profile?.name || 'Administrador',
        },
      });

      if (error) throw error;

      toast({
        title: 'Invitación reenviada',
        description: `Se ha reenviado la invitación a ${invitation.email}`,
      });
    } catch (error: any) {
      logError('Error resending invitation', {
        component: 'AgencyTeamManagement',
        invitationId: invitation.id,
        email: invitation.email,
        error,
      });
      captureException(error, {
        component: 'AgencyTeamManagement',
        action: 'resendInvitation',
      });
      toast({
        title: 'Error',
        description: error.message || 'No se pudo reenviar la invitación',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`¿Remover a ${agentName} del equipo?`)) return;

    try {
      const { error } = await supabase
        .from('agency_agents')
        .delete()
        .eq('agency_id', agencyId)
        .eq('agent_id', agentId);

      if (error) throw error;

      toast({
        title: 'Agente removido',
        description: `${agentName} ha sido removido del equipo`,
      });

      fetchAgents();
    } catch (error) {
      logError('Error removing agent from agency', {
        component: 'AgencyTeamManagement',
        agencyId,
        error,
      });
      captureException(error as Error, {
        component: 'AgencyTeamManagement',
        action: 'removeAgent',
        agencyId,
      });
      toast({
        title: 'Error',
        description: 'No se pudo remover al agente',
        variant: 'destructive',
      });
    }
  };

  const canAddMore = agents.length < maxAgents;

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
          <h3 className="text-lg font-semibold">Equipo de Agentes</h3>
          <p className="text-sm text-muted-foreground">
            {agents.length} de {maxAgents === -1 ? 'ilimitados' : maxAgents} agentes
          </p>
        </div>
        <Button
          onClick={() => setInviteDialogOpen(true)}
          disabled={!canAddMore}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invitar Agente
        </Button>
      </div>

      {/* Alerta si está cerca del límite */}
      {!canAddMore && maxAgents !== -1 && (
        <Alert>
          <AlertDescription>
            Has alcanzado el límite de agentes de tu plan. Mejora tu plan para agregar más miembros al equipo.
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
                      Expira el {new Date(invitation.expires_at).toLocaleDateString('es-MX')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResendInvitation(invitation)}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Reenviar
                  </Button>
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

      {/* Lista de agentes */}
      {agents.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No hay agentes en tu equipo
          </p>
          <Button onClick={() => setInviteDialogOpen(true)}>
            Invitar primer agente
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha de Ingreso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">
                    {agent.profiles?.name || 'Sin nombre'}
                  </TableCell>
                  <TableCell>
                    {agent.profiles?.email || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {agent.profiles?.phone || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {agent.role === 'manager' ? 'Gerente' : 'Agente'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={agent.status === 'active' ? 'default' : 'secondary'}
                    >
                      {agent.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(agent.joined_at).toLocaleDateString('es-MX')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAgent(agent.agent_id, agent.profiles?.name)}
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
            <DialogTitle>Invitar Agente al Equipo</DialogTitle>
            <DialogDescription>
              Envía una invitación por email para agregar un nuevo agente a tu equipo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email del Agente</Label>
              <Input
                id="email"
                type="email"
                placeholder="agente@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agente</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                El agente recibirá un email con instrucciones para unirse a tu equipo
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              disabled={inviting}
            >
              Cancelar
            </Button>
            <Button onClick={handleInviteAgent} disabled={inviting}>
              {inviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
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
