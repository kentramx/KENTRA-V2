import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "./useAdminCheck";
import { toast } from "./use-toast";
import { monitoring } from '@/lib/monitoring';

/**
 * Hook para forzar 2FA en administradores
 * Redirige a la configuración de perfil si un admin no tiene 2FA habilitado
 *
 * SECURITY: This hook uses FAIL-CLOSED approach:
 * - During loading: requirementMet = false (deny access)
 * - On error: requirementMet = false (deny access)
 * - Only when explicitly verified: requirementMet = true
 */
export const useRequire2FA = () => {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, loading: adminLoading } = useAdminCheck();
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    checkMFARequirement();
  }, [isAdmin, isSuperAdmin, adminLoading]);

  const checkMFARequirement = async () => {
    // Reset redirect flag when dependencies change
    hasRedirected.current = false;

    // Esperar a que termine de cargar el estado de admin
    if (adminLoading) {
      return;
    }

    // Si no es admin, no requiere 2FA
    if (!isAdmin && !isSuperAdmin) {
      setChecking(false);
      setMfaEnabled(true); // No aplica para no-admins
      setCheckFailed(false);
      return;
    }

    try {
      setCheckFailed(false);

      // Verificar si el usuario tiene 2FA habilitado
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        throw factorsError;
      }

      const has2FA = factors?.totp?.some(f => f.status === 'verified') || false;

      setMfaEnabled(has2FA);

      // Si es admin y NO tiene 2FA, mostrar advertencia y redirigir
      if ((isAdmin || isSuperAdmin) && !has2FA && !hasRedirected.current) {
        hasRedirected.current = true;
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
      // SECURITY: On error, fail closed - don't grant access
      setMfaEnabled(null);
      setCheckFailed(true);
    } finally {
      setChecking(false);
    }
  };

  // SECURITY: Fail-closed approach
  // - During loading/checking: deny access
  // - On check failure: deny access
  // - Only explicitly verified admins with 2FA get access
  const requirementMet = (() => {
    // Still loading - deny access
    if (checking || adminLoading) {
      return false;
    }

    // Check failed - deny access for admins
    if (checkFailed && (isAdmin || isSuperAdmin)) {
      return false;
    }

    // Not an admin - allow access (no 2FA required)
    if (!isAdmin && !isSuperAdmin) {
      return true;
    }

    // Admin with verified 2FA - allow access
    return mfaEnabled === true;
  })();

  return {
    mfaEnabled,
    checking,
    checkFailed,
    requirementMet,
  };
};
