import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Building2, User, Check, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMonitoring } from "@/lib/monitoring";

interface RoleChangeDialogProps {
  currentRole: 'buyer' | 'agent' | 'agency';
  onRoleChanged: () => void;
}

const RoleChangeDialog = ({ currentRole, onRoleChanged }: RoleChangeDialogProps) => {
  const { error: logError, captureException } = useMonitoring();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [targetRole, setTargetRole] = useState<'agent' | 'agency' | null>(null);
  const navigate = useNavigate();

  const handleRoleChange = async (newRole: 'agent' | 'agency') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('change_user_role', {
        new_role: newRole
      });

      if (error) throw error;

      const result = data as { 
        success: boolean; 
        error?: string; 
        requires_subscription?: boolean;
        requires_plan_change?: boolean;
        suggested_route?: string;
        requires_cleanup?: boolean;
        message?: string;
      };

      if (!result.success) {
        if (result.requires_subscription) {
          toast({
            title: "Suscripción requerida",
            description: "Necesitas contratar un plan para cambiar tu tipo de cuenta",
            variant: "destructive",
          });
          setOpen(false);
          navigate('/publicar');
          return;
        }
        
        if (result.requires_plan_change) {
          toast({
            title: "Plan incorrecto",
            description: result.error || 'Tu plan actual no es compatible con este rol',
            variant: "destructive",
          });
          setOpen(false);
          if (result.suggested_route) {
            setTimeout(() => navigate(result.suggested_route!), 1500);
          }
          return;
        }
        
        if (result.requires_cleanup) {
          toast({
            title: "Acción requerida",
            description: result.error || 'Debes completar algunas acciones antes del cambio',
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Error",
          description: result.error || 'No se pudo cambiar el rol',
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "¡Éxito!",
        description: result.message || 'Tu tipo de cuenta ha sido actualizado',
      });
      
      setOpen(false);
      onRoleChanged();
      
      // Redirigir al dashboard apropiado
      if (newRole === 'agent') {
        navigate('/panel-agente');
      } else if (newRole === 'agency') {
        navigate('/panel-inmobiliaria');
      }
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: "Error",
        description: 'Ocurrió un error al cambiar tu tipo de cuenta',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const availableRoles = useMemo(() => {
    if (currentRole === 'agent') {
      return [{
        value: 'agency' as const,
        label: 'Convertir a Inmobiliaria',
        description: 'Gestiona un equipo de agentes y comparte inventario',
        icon: Building2,
        highlight: 'Ideal para hacer crecer tu negocio',
      }];
    } else if (currentRole === 'agency') {
      return [{
        value: 'agent' as const,
        label: 'Volver a Agente Independiente',
        description: 'Opera como agente individual sin equipo',
        icon: User,
        highlight: 'Necesitarás un plan de agente',
      }];
    } else if (currentRole === 'buyer') {
      return [
        {
          value: 'agent' as const,
          label: 'Convertir a Agente',
          description: 'Publica propiedades como agente independiente',
          icon: User,
          highlight: 'Requiere plan de agente',
        },
        {
          value: 'agency' as const,
          label: 'Convertir a Inmobiliaria',
          description: 'Gestiona una agencia con equipo de agentes',
          icon: Building2,
          highlight: 'Requiere plan de inmobiliaria',
        },
      ];
    }
    return [];
  }, [currentRole]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Cambiar Tipo de Cuenta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cambiar Tipo de Cuenta</DialogTitle>
          <DialogDescription>
            Selecciona el nuevo tipo de cuenta que deseas tener
          </DialogDescription>
        </DialogHeader>
        
        {currentRole === 'agency' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Asegúrate de no tener agentes asignados en tu equipo antes de cambiar
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 py-4">
          {availableRoles.map((option) => (
            <Card
              key={option.value}
              className={`cursor-pointer transition-all hover:shadow-md ${
                targetRole === option.value 
                  ? 'border-primary ring-2 ring-primary ring-offset-2' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setTargetRole(option.value)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <option.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-semibold leading-none">{option.label}</h4>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {option.highlight}
                    </Badge>
                  </div>
                  {targetRole === option.value && (
                    <Check className="h-5 w-5 text-primary shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => targetRole && handleRoleChange(targetRole)}
            disabled={!targetRole || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cambiando...
              </>
            ) : (
              'Confirmar Cambio'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RoleChangeDialog;
