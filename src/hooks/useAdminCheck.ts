import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { monitoring } from '@/lib/monitoring';
import type { AppRole } from '@/types/user';

const IMPERSONATION_KEY = 'kentra_impersonated_role';

export const useAdminCheck = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    checkAdminStatus();

    return () => {
      mountedRef.current = false;
    };
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
      // Check if impersonating a non-admin role
      const impersonatedRole = localStorage.getItem(IMPERSONATION_KEY);
      if (impersonatedRole && ['buyer', 'agent', 'agency'].includes(impersonatedRole)) {
        // Verify user is actually super admin before allowing impersonation
        const { data: isSuperData } = await supabase.rpc('is_super_admin' as any, {
          user_uuid: user.id,
        });

        if (!mountedRef.current) return;

        if (isSuperData) {
          // Simulate non-admin role
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setAdminRole(null);
          setLoading(false);
          return;
        }
      }

      // Verificar acceso administrativo general usando has_admin_access
      const { data: hasAccessData, error: accessError } = await supabase.rpc('has_admin_access' as any, {
        user_uuid: user.id,
      });

      if (!mountedRef.current) return;

      if (accessError) {
        monitoring.error('Error checking admin access', { hook: 'useAdminCheck', error: accessError });
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminRole(null);
      } else {
        setIsAdmin(Boolean(hasAccessData));

        if (hasAccessData) {
          // Si tiene acceso admin, verificar si es super_admin
          const { data: isSuperData, error: superError } = await supabase.rpc('is_super_admin' as any, {
            user_uuid: user.id,
          });

          if (!mountedRef.current) return;

          if (!superError) {
            setIsSuperAdmin(Boolean(isSuperData));
          }

          // Check if impersonating moderator
          if (impersonatedRole === 'moderator' && isSuperData) {
            setIsAdmin(true);
            setIsSuperAdmin(false);
            setAdminRole('moderator');
            setLoading(false);
            return;
          }

          // Obtener el rol específico
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .in('role', ['super_admin', 'moderator'])
            .single();

          if (!mountedRef.current) return;

          if (roleData) {
            setAdminRole(roleData.role as AppRole);
          }
        }
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
