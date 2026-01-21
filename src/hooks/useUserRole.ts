import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { monitoring } from '@/lib/monitoring';
import { IMPERSONATION_KEY_PREFIX } from '@/config/constants';
import type { AppRole } from '@/types/user';

export type UserRole = AppRole;

// Role priority: super_admin > admin > moderator > agency/developer > agent > buyer
const ROLE_PRIORITY: Record<UserRole, number> = {
  super_admin: 6,
  admin: 5,
  moderator: 4,
  agency: 3,
  developer: 3,
  agent: 2,
  buyer: 1,
};

export const useUserRole = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Get user-specific impersonation key
  const getImpersonationKey = useCallback(
    () => (user ? `${IMPERSONATION_KEY_PREFIX}_${user.id}` : null),
    [user]
  );

  const fetchUserRole = useCallback(async () => {
    if (!user) {
      if (mountedRef.current) {
        setUserRole(null);
        setLoading(false);
      }
      return;
    }

    try {
      // OPTIMIZATION: Single query to get all roles, then determine impersonation
      // This avoids sequential RPC calls (was: check impersonation -> check is_super_admin -> get roles)
      const { data: allRoles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!mountedRef.current) return;

      if (error) {
        monitoring.error('Error fetching user roles', { hook: 'useUserRole', error });
        setUserRole('buyer');
        setLoading(false);
        return;
      }

      if (!allRoles || allRoles.length === 0) {
        setUserRole('buyer');
        setLoading(false);
        return;
      }

      // Find the highest priority role
      const highestRole = allRoles.reduce((highest, current) => {
        const currentRole = current.role as UserRole;
        const currentPriority = ROLE_PRIORITY[currentRole] || 0;
        const highestPriority = ROLE_PRIORITY[highest] || 0;
        return currentPriority > highestPriority ? currentRole : highest;
      }, 'buyer' as UserRole);

      // Check impersonation only if user has super_admin role
      const impersonationKey = getImpersonationKey();
      if (highestRole === 'super_admin' && impersonationKey) {
        const impersonatedRole = localStorage.getItem(impersonationKey);
        if (impersonatedRole && ROLE_PRIORITY[impersonatedRole as UserRole]) {
          setUserRole(impersonatedRole as UserRole);
          setLoading(false);
          return;
        }
      }

      setUserRole(highestRole);
    } catch (error) {
      if (!mountedRef.current) return;
      monitoring.captureException(error as Error, { hook: 'useUserRole' });
      setUserRole('buyer');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [user, getImpersonationKey]);

  useEffect(() => {
    mountedRef.current = true;

    if (user) {
      fetchUserRole();
    } else {
      setUserRole(null);
      setLoading(false);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [user, fetchUserRole]);

  return { userRole, loading, refetch: fetchUserRole };
};
