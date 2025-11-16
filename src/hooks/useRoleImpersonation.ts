import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { monitoring } from '@/lib/monitoring';

const IMPERSONATION_KEY = 'kentra_impersonated_role';

export type ImpersonatedRole = 'buyer' | 'agent' | 'agency' | 'moderator' | null;

export const useRoleImpersonation = () => {
  const [impersonatedRole, setImpersonatedRole] = useState<ImpersonatedRole>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkSuperAdminStatus();
    loadImpersonatedRole();
  }, []);

  const checkSuperAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsSuperAdmin(false);
      return;
    }

    const { data, error } = await (supabase.rpc as any)('is_super_admin', {
      _user_id: user.id,
    });

    if (!error && data) {
      setIsSuperAdmin(true);
    }
  };

  const loadImpersonatedRole = () => {
    const stored = localStorage.getItem(IMPERSONATION_KEY);
    if (stored) {
      setImpersonatedRole(stored as ImpersonatedRole);
      setIsImpersonating(true);
    }
  };

  const startImpersonation = (role: ImpersonatedRole) => {
    if (!isSuperAdmin) {
      monitoring.warn('Only super admins can impersonate roles', { hook: 'useRoleImpersonation' });
      return;
    }

    if (role) {
      localStorage.setItem(IMPERSONATION_KEY, role);
      setImpersonatedRole(role);
      setIsImpersonating(true);
    }
  };

  const stopImpersonation = () => {
    localStorage.removeItem(IMPERSONATION_KEY);
    setImpersonatedRole(null);
    setIsImpersonating(false);
  };

  const isSimulating = () => {
    return localStorage.getItem(IMPERSONATION_KEY) !== null;
  };

  // Retornar IDs de usuarios demo según el rol simulado
  const getDemoUserId = (): string | null => {
    if (!isImpersonating || !impersonatedRole) return null;
    
    switch (impersonatedRole) {
      case 'agent':
        return '00000000-0000-0000-0000-000000000001'; // Demo Agent
      case 'agency':
        return '00000000-0000-0000-0000-000000000010'; // Demo Agency Owner
      default:
        return null;
    }
  };

  const getDemoAgencyId = (): string | null => {
    if (!isImpersonating || impersonatedRole !== 'agency') return null;
    return '20000000-0000-0000-0000-000000000001'; // Demo Agency
  };

  return {
    impersonatedRole,
    isImpersonating,
    isSuperAdmin,
    startImpersonation,
    stopImpersonation,
    isSimulating,
    getDemoUserId,
    getDemoAgencyId,
  };
};
