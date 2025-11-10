import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Briefcase, Building2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

type RoleOption = 'buyer' | 'agent' | 'agency';

const EligeRolPublicacion = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');

  const handleRoleSelection = async (targetRole: RoleOption) => {
    // Si no hay usuario, guardar selección y redirigir a auth
    if (!user) {
      localStorage.setItem('pendingRoleSelection', targetRole);
      navigate(`/auth?redirect=/elige-rol-publicacion&role=${targetRole}`);
      return;
    }

    setLoading(true);
    try {
      // 1. Obtener rol actual del usuario
      const { data: currentRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      // 2. Si el rol actual es diferente al seleccionado, actualizar
      if (currentRoleData?.role !== targetRole) {
        await supabase
          .from('user_roles')
          .update({ role: targetRole })
          .eq('user_id', user.id);

        toast({
          title: 'Rol actualizado',
          description: `Ahora eres ${targetRole === 'buyer' ? 'Particular' : targetRole === 'agent' ? 'Agente' : 'Agencia'}`,
        });
      }

      // 3. Validar según el rol seleccionado
      if (targetRole === 'buyer') {
        // Verificar si puede publicar
        const { data: validation } = await supabase.rpc('can_create_property', {
          user_uuid: user.id,
        });

        if (validation && validation[0]?.can_create) {
          navigate('/panel-agente');
        } else {
          setLimitMessage(validation?.[0]?.reason || 'Ya tienes 1 propiedad publicada');
          setShowUpgradeModal(true);
        }
      } else {
        // Agent o Agency - verificar suscripción
        const { data: subInfo } = await supabase.rpc('get_user_subscription_info', {
          user_uuid: user.id,
        });

        if (subInfo && subInfo.length > 0 && subInfo[0].has_subscription) {
          // Tiene suscripción - validar slots disponibles
          const { data: validation } = await supabase.rpc('can_create_property', {
            user_uuid: user.id,
          });

          if (validation && validation[0]?.can_create) {
            navigate('/panel-agente');
          } else {
            setLimitMessage(validation?.[0]?.reason || 'Has alcanzado el límite de tu plan');
            setShowLimitModal(true);
          }
        } else {
          // NO tiene suscripción - mostrar información
          toast({
            title: 'Suscripción requerida',
            description: `Para publicar como ${targetRole === 'agent' ? 'Agente' : 'Inmobiliaria'}, necesitas un plan activo. Contacta con nosotros para más información.`,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error selecting role:', error);
      toast({
        title: 'Error',
        description: 'Hubo un problema al procesar tu selección',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    {
      role: 'buyer' as RoleOption,
      icon: User,
      title: 'Soy Particular',
      description: 'Publica 1 propiedad gratis',
      badge: 'GRATIS',
      badgeVariant: 'default' as const,
      features: ['Sin comisiones', 'Fácil y rápido', 'Sin pagos recurrentes'],
      cta: 'Publicar Gratis',
    },
    {
      role: 'agent' as RoleOption,
      icon: Briefcase,
      title: 'Soy Agente Inmobiliario',
      description: 'Gestiona tu cartera de propiedades',
      badge: 'Desde $499/mes',
      badgeVariant: 'secondary' as const,
      features: ['Hasta 50 propiedades', 'Analytics avanzados', 'Propiedades destacadas'],
      cta: 'Ver Planes de Agente',
    },
    {
      role: 'agency' as RoleOption,
      icon: Building2,
      title: 'Soy Agencia Inmobiliaria',
      description: 'Gestión completa para tu inmobiliaria',
      badge: 'Desde $4,999/mes',
      badgeVariant: 'secondary' as const,
      features: ['Propiedades ilimitadas', 'Multi-agente', 'API de integración'],
      cta: 'Ver Planes de Agencia',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <DynamicBreadcrumbs
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Publicar Propiedad', href: '', active: true },
          ]}
          className="mb-4"
        />

        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              ¿Cómo quieres publicar?
            </h1>
            <p className="text-xl text-muted-foreground">
              Elige la opción que mejor se ajuste a ti
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {roleOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card
                  key={option.role}
                  className="relative hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => !loading && handleRoleSelection(option.role)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant={option.badgeVariant}>{option.badge}</Badge>
                    </div>
                    <CardTitle className="text-2xl">{option.title}</CardTitle>
                    <CardDescription className="text-base">{option.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 mb-6">
                      {option.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        option.cta
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>

      {/* Modal de Upgrade para Particulares */}
      <AlertDialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Has alcanzado tu límite</AlertDialogTitle>
            <AlertDialogDescription>
              {limitMessage}
              <br />
              <br />
              Conviértete en Agente para publicar más propiedades y acceder a herramientas
              profesionales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendido</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Límite para Agentes */}
      <AlertDialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Límite de plan alcanzado</AlertDialogTitle>
            <AlertDialogDescription>
              {limitMessage}
              <br />
              <br />
              Mejora tu plan para publicar más propiedades y acceder a funcionalidades avanzadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendido</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EligeRolPublicacion;
