import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Navbar from '@/components/Navbar';

export default function UnirseEquipo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      loadInvitation();
    } else {
      setError('Token de invitación no válido');
      setLoading(false);
    }
  }, [token]);

  const loadInvitation = async () => {
    try {
      // Primero expirar invitaciones vencidas
      await supabase.rpc('expire_old_invitations' as any);

      // Cargar la invitación
      const { data, error: invError } = await supabase
        .from('agency_invitations')
        .select(`
          *,
          agency:agency_id (
            id,
            name,
            city,
            state
          ),
          inviter:invited_by (
            id,
            raw_user_meta_data
          )
        `)
        .eq('token', token)
        .single();

      if (invError || !data) {
        setError('Invitación no encontrada');
        return;
      }

      if (data.status === 'expired') {
        setError('Esta invitación ha expirado');
        return;
      }

      if (data.status === 'accepted') {
        setError('Esta invitación ya ha sido aceptada');
        return;
      }

      if (data.status === 'rejected') {
        setError('Esta invitación fue rechazada');
        return;
      }

      // Verificar que el email coincida con el usuario autenticado (si hay usuario)
      if (user && user.email !== data.email) {
        setError('Esta invitación fue enviada a otro email. Inicia sesión con la cuenta correcta.');
        return;
      }

      setInvitation(data);
    } catch (error) {
      console.error('Error loading invitation:', error);
      setError('Error al cargar la invitación');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!user) {
      // Guardar token en localStorage para después del login
      localStorage.setItem('pending_invitation_token', token!);
      navigate(`/auth?redirect=/unirse-equipo?token=${token}`);
      return;
    }

    // Verificar si está en modo simulación
    const IMPERSONATION_KEY = 'kentra_impersonated_role';
    const isSimulating = localStorage.getItem(IMPERSONATION_KEY) !== null;
    
    if (isSimulating) {
      toast({
        title: 'Modo de Simulación Activo',
        description: 'Esta acción no se puede ejecutar durante la simulación. Sal del modo de simulación para realizar cambios reales.',
        variant: 'default',
      });
      return;
    }

    setAccepting(true);
    try {
      // Verificar que el usuario tenga el rol correcto (debe ser agent)
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!userRoleData || userRoleData.role !== 'agent') {
        toast({
          title: 'Error',
          description: 'Solo usuarios con rol de agente pueden unirse a un equipo. Cambia tu tipo de cuenta primero.',
          variant: 'destructive',
        });
        setAccepting(false);
        return;
      }

      // Actualizar la invitación a aceptada
      const { error: updateError } = await supabase
        .from('agency_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('token', token);

      if (updateError) throw updateError;

      // Agregar al agente al equipo
      const { error: insertError } = await supabase
        .from('agency_agents')
        .insert({
          agency_id: invitation.agency_id,
          agent_id: user.id,
          role: invitation.role,
          status: 'active',
        });

      if (insertError) throw insertError;

      setSuccess(true);
      
      toast({
        title: '¡Bienvenido al equipo!',
        description: `Ahora eres parte de ${invitation.agency.name}`,
      });

      // Redirigir al dashboard de agente después de 2 segundos
      setTimeout(() => {
        navigate('/panel-agente');
      }, 2000);

    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo aceptar la invitación',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (!confirm('¿Estás seguro de que deseas rechazar esta invitación?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agency_invitations')
        .update({ status: 'rejected' })
        .eq('token', token);

      if (error) throw error;

      toast({
        title: 'Invitación rechazada',
        description: 'Has rechazado la invitación al equipo',
      });

      navigate('/');
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      toast({
        title: 'Error',
        description: 'No se pudo rechazar la invitación',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {error ? (
          <Card className="border-destructive">
            <CardHeader>
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle>Invitación No Válida</CardTitle>
                  <CardDescription>{error}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/')} className="w-full">
                Volver al Inicio
              </Button>
            </CardContent>
          </Card>
        ) : success ? (
          <Card className="border-green-500">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <CardTitle>¡Invitación Aceptada!</CardTitle>
                  <CardDescription>
                    Ahora eres parte del equipo de {invitation.agency.name}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Redirigiendo a tu panel de agente...
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : invitation ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>Invitación de Equipo</CardTitle>
                  <CardDescription>
                    Has sido invitado a unirte a un equipo inmobiliario
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Detalles de la invitación */}
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Inmobiliaria</p>
                  <p className="font-semibold text-lg">{invitation.agency.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ubicación</p>
                  <p className="font-medium">
                    {invitation.agency.city}, {invitation.agency.state}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tu Rol</p>
                  <p className="font-medium">
                    {invitation.role === 'manager' ? 'Gerente' : 'Agente'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email de Invitación</p>
                  <p className="font-medium">{invitation.email}</p>
                </div>
              </div>

              {/* Beneficios */}
              <div>
                <h4 className="font-semibold mb-3">Al unirte al equipo podrás:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Gestionar el inventario compartido de propiedades</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Acceder a herramientas profesionales de venta</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Colaborar con otros agentes del equipo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Beneficiarte del plan de suscripción de la inmobiliaria</span>
                  </li>
                </ul>
              </div>

              {/* Advertencia si no está autenticado */}
              {!user && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Necesitas iniciar sesión o crear una cuenta para aceptar esta invitación.
                  </AlertDescription>
                </Alert>
              )}

              {/* Expira en */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta invitación expira el {new Date(invitation.expires_at).toLocaleDateString('es-MX', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </AlertDescription>
              </Alert>

              {/* Acciones */}
              <div className="flex gap-3">
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={accepting}
                  className="flex-1"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Aceptando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Aceptar Invitación
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleRejectInvitation}
                  variant="outline"
                  disabled={accepting}
                >
                  Rechazar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}