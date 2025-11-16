import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { monitoring } from '@/lib/monitoring';

const IMPERSONATION_KEY = 'kentra_impersonated_role';

export type UserRole = 'buyer' | 'agent' | 'agency' | 'super_admin' | 'moderator';

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

      // Get ALL roles for the user
      const { data: allRoles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        monitoring.error('Error fetching user roles', { hook: 'useUserRole', error });
        setUserRole('buyer');
        setLoading(false);
        return;
      }

      if (!allRoles || allRoles.length === 0) {
        setUserRole('buyer'); // Default role
        setLoading(false);
        return;
      }

      // Role priority: super_admin > moderator > agency > agent > buyer
      const rolePriority: Record<UserRole, number> = {
        super_admin: 5,
        moderator: 4,
        agency: 3,
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
      monitoring.captureException(error as Error, { hook: 'useUserRole' });
      setUserRole('buyer');
    } finally {
      setLoading(false);
    }
  };

  return { userRole, loading, refetch: fetchUserRole };
};
