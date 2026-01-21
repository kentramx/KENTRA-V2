import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { monitoring } from '@/lib/monitoring';
import type { AppRole } from '@/types/user';

const IMPERSONATION_KEY = 'kentra_impersonated_role';

export type UserRole = AppRole;

export const useUserRole = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchUserRole = useCallback(async () => {
    if (!user) {
      if (mountedRef.current) {
        setUserRole(null);
        setLoading(false);
      }
      return;
    }

    try {
      // Check if impersonating
      const impersonatedRole = localStorage.getItem(IMPERSONATION_KEY);
      if (impersonatedRole) {
        // Verify user is actually super admin
        const { data: isSuperData } = await supabase.rpc('is_super_admin' as any, {
          user_uuid: user.id,
        });

        if (!mountedRef.current) return;

        if (isSuperData) {
          setUserRole(impersonatedRole as UserRole);
          setLoading(false);
          return;
        }
      }

      // Get ALL roles for the user
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

      // Role priority: super_admin > admin > moderator > agency/developer > agent > buyer
      const rolePriority: Record<UserRole, number> = {
        super_admin: 6,
        admin: 5,
        moderator: 4,
        agency: 3,
        developer: 3,
        agent: 2,
        buyer: 1,
      };

      // Find the highest priority role
      const highestRole = allRoles.reduce((highest, current) => {
        const currentRole = current.role as UserRole;
        const currentPriority = rolePriority[currentRole] || 0;
        const highestPriority = rolePriority[highest] || 0;
        return currentPriority > highestPriority ? currentRole : highest;
      }, 'buyer' as UserRole);

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
  }, [user]);

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
