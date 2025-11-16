import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "./useAdminCheck";
import { toast } from "./use-toast";
import { monitoring } from '@/lib/monitoring';

/**
 * Hook para forzar 2FA en administradores
 * Redirige a la configuración de perfil si un admin no tiene 2FA habilitado
 */
export const useRequire2FA = () => {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, loading: adminLoading } = useAdminCheck();
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkMFARequirement();
  }, [isAdmin, isSuperAdmin, adminLoading]);

  const checkMFARequirement = async () => {
    // Esperar a que termine de cargar el estado de admin
    if (adminLoading) {
      return;
    }

    // Si no es admin, no requiere 2FA
    if (!isAdmin && !isSuperAdmin) {
      setChecking(false);
      setMfaEnabled(true); // No aplica para no-admins
      return;
    }

    try {
      // Verificar si el usuario tiene 2FA habilitado
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const has2FA = factors?.totp?.some(f => f.status === 'verified') || false;
      
      setMfaEnabled(has2FA);

      // Si es admin y NO tiene 2FA, mostrar advertencia y redirigir
      if ((isAdmin || isSuperAdmin) && !has2FA) {
        toast({
          title: "Seguridad requerida",
          description: "Como administrador, debes habilitar 2FA antes de acceder a funciones administrativas.",
          variant: "destructive",
        });
        
        // Redirigir a la pestaña de seguridad del perfil
        setTimeout(() => {
          navigate("/perfil?tab=security");
        }, 2000);
      }
    } catch (error) {
      monitoring.error("Error checking 2FA requirement", { hook: 'useRequire2FA', error });
      setMfaEnabled(null);
    } finally {
      setChecking(false);
    }
  };

  return {
    mfaEnabled,
    checking,
    requirementMet: mfaEnabled === true || (!isAdmin && !isSuperAdmin),
  };
};
