import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ChurchPermission = Database['public']['Enums']['church_permission'];

interface UsePermissionsProps {
  userId?: string;
  churchId?: string;
}

export function usePermissions({ userId, churchId }: UsePermissionsProps = {}) {
  const [permissions, setPermissions] = useState<Set<ChurchPermission>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId && churchId) {
      loadPermissions();
    } else {
      setLoading(false);
    }
  }, [userId, churchId]);

  const loadPermissions = async () => {
    if (!userId || !churchId) return;

    setLoading(true);
    try {
      const { data } = await supabase
        .from('church_member_permissions')
        .select('permission')
        .eq('user_id', userId)
        .eq('church_id', churchId);

      if (data) {
        setPermissions(new Set(data.map((p) => p.permission)));
      }
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: ChurchPermission) => {
    return permissions.has(permission);
  };

  const hasAnyPermission = (...requiredPermissions: ChurchPermission[]) => {
    return requiredPermissions.some((permission) => permissions.has(permission));
  };

  const hasAllPermissions = (...requiredPermissions: ChurchPermission[]) => {
    return requiredPermissions.every((permission) => permissions.has(permission));
  };

  return {
    permissions: Array.from(permissions),
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    loading,
    refresh: loadPermissions,
  };
}
