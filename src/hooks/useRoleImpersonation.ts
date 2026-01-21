import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { monitoring } from '@/lib/monitoring';

// SECURITY: Key prefix - actual key includes user ID to prevent cross-user data leakage
const IMPERSONATION_KEY_PREFIX = 'kentra_impersonated_role';

export type ImpersonatedRole = 'buyer' | 'agent' | 'agency' | 'developer' | 'moderator' | null;

export const useRoleImpersonation = () => {
  const [impersonatedRole, setImpersonatedRole] = useState<ImpersonatedRole>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Get user-specific localStorage key
  const getStorageKey = (userId: string | null) => {
    if (!userId) return null;
    return `${IMPERSONATION_KEY_PREFIX}_${userId}`;
  };

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
        setCurrentUserId(null);
        // Clear any stale impersonation data if not logged in
        clearImpersonationData(null);
        return;
      }

      setCurrentUserId(user.id);

      const { data, error } = await (supabase.rpc as any)('is_super_admin', {
        _user_id: user.id,
      });

      if (!mountedRef.current) return;

      if (!error && data) {
        setIsSuperAdmin(true);
        // Only load impersonated role AFTER confirming super admin status
        loadImpersonatedRole(user.id);
      } else {
        setIsSuperAdmin(false);
        // SECURITY: Clear any impersonation data if user is not super admin
        // This prevents localStorage manipulation attacks
        clearImpersonationData(user.id);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      monitoring.error('Error checking super admin status', { hook: 'useRoleImpersonation', error });
      // On error, clear impersonation data as a security precaution
      clearImpersonationData(currentUserId);
    }
  };

  const clearImpersonationData = (userId: string | null) => {
    const storageKey = getStorageKey(userId);
    if (!storageKey) return;

    const stored = localStorage.getItem(storageKey);
    if (stored) {
      localStorage.removeItem(storageKey);
      monitoring.warn('Cleared unauthorized impersonation data', { hook: 'useRoleImpersonation' });
    }
    setImpersonatedRole(null);
    setIsImpersonating(false);
  };

  const loadImpersonatedRole = (userId: string) => {
    const storageKey = getStorageKey(userId);
    if (!storageKey) return;

    const stored = localStorage.getItem(storageKey);
    // Validate the stored role is a valid value
    const validRoles: ImpersonatedRole[] = ['buyer', 'agent', 'agency', 'developer', 'moderator'];
    if (stored && validRoles.includes(stored as ImpersonatedRole)) {
      setImpersonatedRole(stored as ImpersonatedRole);
      setIsImpersonating(true);
    } else if (stored) {
      // Invalid role in localStorage, clear it
      localStorage.removeItem(storageKey);
      monitoring.warn('Cleared invalid impersonation role from localStorage', { hook: 'useRoleImpersonation', stored });
    }
  };

  const startImpersonation = useCallback((role: ImpersonatedRole) => {
    if (!isSuperAdmin || !currentUserId) {
      monitoring.warn('Only super admins can impersonate roles', { hook: 'useRoleImpersonation' });
      return;
    }

    const storageKey = getStorageKey(currentUserId);
    if (!storageKey) return;

    if (role) {
      localStorage.setItem(storageKey, role);
      setImpersonatedRole(role);
      setIsImpersonating(true);
    }
  }, [isSuperAdmin, currentUserId]);

  const stopImpersonation = useCallback(() => {
    const storageKey = getStorageKey(currentUserId);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    setImpersonatedRole(null);
    setIsImpersonating(false);
  }, [currentUserId]);

  const isSimulating = useCallback(() => {
    const storageKey = getStorageKey(currentUserId);
    if (!storageKey) return false;
    return localStorage.getItem(storageKey) !== null;
  }, [currentUserId]);

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
