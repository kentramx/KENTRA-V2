import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { monitoring } from '@/lib/monitoring';

const IMPERSONATION_KEY = 'kentra_impersonated_role';

export type ImpersonatedRole = 'buyer' | 'agent' | 'agency' | 'developer' | 'moderator' | null;

export const useRoleImpersonation = () => {
  const [impersonatedRole, setImpersonatedRole] = useState<ImpersonatedRole>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    checkSuperAdminStatus();
    loadImpersonatedRole();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkSuperAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!mountedRef.current) return;

      if (!user) {
        setIsSuperAdmin(false);
        return;
      }

      const { data, error } = await (supabase.rpc as any)('is_super_admin', {
        _user_id: user.id,
      });

      if (!mountedRef.current) return;

      if (!error && data) {
        setIsSuperAdmin(true);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      monitoring.error('Error checking super admin status', { hook: 'useRoleImpersonation', error });
    }
  };

  const loadImpersonatedRole = () => {
    const stored = localStorage.getItem(IMPERSONATION_KEY);
    if (stored) {
      setImpersonatedRole(stored as ImpersonatedRole);
      setIsImpersonating(true);
    }
  };

  const startImpersonation = useCallback((role: ImpersonatedRole) => {
    if (!isSuperAdmin) {
      monitoring.warn('Only super admins can impersonate roles', { hook: 'useRoleImpersonation' });
      return;
    }

    if (role) {
      localStorage.setItem(IMPERSONATION_KEY, role);
      setImpersonatedRole(role);
      setIsImpersonating(true);
    }
  }, [isSuperAdmin]);

  const stopImpersonation = useCallback(() => {
    localStorage.removeItem(IMPERSONATION_KEY);
    setImpersonatedRole(null);
    setIsImpersonating(false);
  }, []);

  const isSimulating = useCallback(() => {
    return localStorage.getItem(IMPERSONATION_KEY) !== null;
  }, []);

  const getDemoUserId = useCallback((): string | null => {
    if (!isImpersonating || !impersonatedRole) return null;

    switch (impersonatedRole) {
      case 'agent':
        return '00000000-0000-0000-0000-000000000001';
      case 'agency':
        return '00000000-0000-0000-0000-000000000010';
      case 'developer':
        return '00000000-0000-0000-0000-000000000020';
      default:
        return null;
    }
  }, [isImpersonating, impersonatedRole]);

  const getDemoAgencyId = useCallback((): string | null => {
    if (!isImpersonating || impersonatedRole !== 'agency') return null;
    return '20000000-0000-0000-0000-000000000001';
  }, [isImpersonating, impersonatedRole]);

  const getDemoDeveloperId = useCallback((): string | null => {
    if (!isImpersonating || impersonatedRole !== 'developer') return null;
    return '30000000-0000-0000-0000-000000000001';
  }, [isImpersonating, impersonatedRole]);

  return {
    impersonatedRole,
    isImpersonating,
    isSuperAdmin,
    startImpersonation,
    stopImpersonation,
    isSimulating,
    getDemoUserId,
    getDemoAgencyId,
    getDemoDeveloperId,
  };
};
