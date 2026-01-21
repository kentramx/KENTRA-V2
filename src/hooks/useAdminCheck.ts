import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { monitoring } from '@/lib/monitoring';
import { IMPERSONATION_KEY_PREFIX } from '@/config/constants';
import type { AppRole } from '@/types/user';

export const useAdminCheck = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Get user-specific impersonation key
  const getImpersonationKey = () => user ? `${IMPERSONATION_KEY_PREFIX}_${user.id}` : null;

  useEffect(() => {
    mountedRef.current = true;
    checkAdminStatus();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkAdminStatus is intentionally not in deps; it reads user directly and is defined inside the hook
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      if (mountedRef.current) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminRole(null);
        setLoading(false);
      }
      return;
    }

    try {
      // OPTIMIZATION: Single query to get admin role - avoids multiple RPC calls
      // is_super_admin implies has_admin_access, so check super_admin first
      const { data: isSuperData, error: superError } = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)('is_super_admin', {
        user_uuid: user.id,
      });

      if (!mountedRef.current) return;

      if (superError) {
        monitoring.error('Error checking super admin status', { hook: 'useAdminCheck', error: superError });
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminRole(null);
        setLoading(false);
        return;
      }

      const isSuperAdmin = Boolean(isSuperData);

      // Check impersonation (user-specific key)
      const impersonationKey = getImpersonationKey();
      const impersonatedRole = impersonationKey ? localStorage.getItem(impersonationKey) : null;

      // If super admin is impersonating a non-admin role
      if (isSuperAdmin && impersonatedRole && ['buyer', 'agent', 'agency'].includes(impersonatedRole)) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminRole(null);
        setLoading(false);
        return;
      }

      // If super admin is impersonating moderator
      if (isSuperAdmin && impersonatedRole === 'moderator') {
        setIsAdmin(true);
        setIsSuperAdmin(false);
        setAdminRole('moderator');
        setLoading(false);
        return;
      }

      // If user is super admin (not impersonating)
      if (isSuperAdmin) {
        setIsAdmin(true);
        setIsSuperAdmin(true);
        setAdminRole('super_admin');
        setLoading(false);
        return;
      }

      // Not super admin - check if moderator (single additional query)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'moderator')
        .maybeSingle();

      if (!mountedRef.current) return;

      if (roleData) {
        setIsAdmin(true);
        setIsSuperAdmin(false);
        setAdminRole('moderator');
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminRole(null);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      monitoring.captureException(error as Error, { hook: 'useAdminCheck' });
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setAdminRole(null);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return { isAdmin, isSuperAdmin, adminRole, loading };
};
