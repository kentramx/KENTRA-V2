import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      console.error('Only super admins can impersonate roles');
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

  return {
    impersonatedRole,
    isImpersonating,
    isSuperAdmin,
    startImpersonation,
    stopImpersonation,
  };
};
