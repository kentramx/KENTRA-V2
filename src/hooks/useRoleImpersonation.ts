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
    // SECURITY: Must verify super admin status BEFORE loading impersonated role
    checkSuperAdminStatus();

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
        // Clear any stale impersonation data if not logged in
        clearImpersonationData();
        return;
      }

      const { data, error } = await (supabase.rpc as any)('is_super_admin', {
        _user_id: user.id,
      });

      if (!mountedRef.current) return;

      if (!error && data) {
        setIsSuperAdmin(true);
        // Only load impersonated role AFTER confirming super admin status
        loadImpersonatedRole();
      } else {
        setIsSuperAdmin(false);
        // SECURITY: Clear any impersonation data if user is not super admin
        // This prevents localStorage manipulation attacks
        clearImpersonationData();
      }
    } catch (error) {
      if (!mountedRef.current) return;
      monitoring.error('Error checking super admin status', { hook: 'useRoleImpersonation', error });
      // On error, clear impersonation data as a security precaution
      clearImpersonationData();
    }
  };

  const clearImpersonationData = () => {
    const stored = localStorage.getItem(IMPERSONATION_KEY);
    if (stored) {
      localStorage.removeItem(IMPERSONATION_KEY);
      monitoring.warn('Cleared unauthorized impersonation data', { hook: 'useRoleImpersonation' });
    }
    setImpersonatedRole(null);
    setIsImpersonating(false);
  };

  const loadImpersonatedRole = () => {
    const stored = localStorage.getItem(IMPERSONATION_KEY);
    // Validate the stored role is a valid value
    const validRoles: ImpersonatedRole[] = ['buyer', 'agent', 'agency', 'developer', 'moderator'];
    if (stored && validRoles.includes(stored as ImpersonatedRole)) {
      setImpersonatedRole(stored as ImpersonatedRole);
      setIsImpersonating(true);
    } else if (stored) {
      // Invalid role in localStorage, clear it
      localStorage.removeItem(IMPERSONATION_KEY);
      monitoring.warn('Cleared invalid impersonation role from localStorage', { hook: 'useRoleImpersonation', stored });
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
