import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const IMPERSONATION_KEY = 'kentra_impersonated_role';

export type UserRole = 'buyer' | 'agent' | 'agency' | 'developer' | 'super_admin' | 'moderator';

export const useUserRole = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    } else {
      setUserRole(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRole = async () => {
    if (!user) return;

    try {
      // Check if impersonating
      const impersonatedRole = localStorage.getItem(IMPERSONATION_KEY);
      if (impersonatedRole) {
        // Verify user is actually super admin
        const { data: isSuperData } = await (supabase.rpc as any)('is_super_admin', {
          _user_id: user.id,
        });

        if (isSuperData) {
          setUserRole(impersonatedRole as UserRole);
          setLoading(false);
          return;
        }
      }

      // Check admin roles first
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['super_admin', 'moderator'] as any)
        .maybeSingle();

      if (roleData?.role) {
        setUserRole(roleData.role as UserRole);
        setLoading(false);
        return;
      }

      // Check regular roles
      const { data: regularRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['buyer', 'agent', 'agency', 'developer'] as any)
        .maybeSingle();

      if (regularRoleData?.role) {
        setUserRole(regularRoleData.role as UserRole);
      } else {
        setUserRole('buyer'); // Default role
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('buyer');
    } finally {
      setLoading(false);
    }
  };

  return { userRole, loading, refetch: fetchUserRole };
};
