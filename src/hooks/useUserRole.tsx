import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'admin' | 'client' | 'tesoureiro' | 'secretario' | 'gerente_ebd' | 'representante' | 'financeiro' | 'autor' | 'gerente_royalties' | 'gerente_sorteio';

const ROLE_PRIORITY: AppRole[] = ['admin', 'gerente_royalties', 'financeiro', 'gerente_ebd', 'gerente_sorteio', 'secretario', 'tesoureiro', 'representante', 'autor', 'client'];

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadRole();
    } else {
      setRole(null);
      setRoles([]);
      setLoading(false);
    }
  }, [user?.id]);

  const loadRole = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) {
        console.warn('Role não encontrada:', error.message);
        setRole(null);
        setRoles([]);
      } else {
        const loadedRoles = (data || []).map(({ role: loadedRole }) => loadedRole as AppRole);
        const primaryRole = ROLE_PRIORITY.find((priorityRole) => loadedRoles.includes(priorityRole)) || loadedRoles[0] || null;

        setRoles(loadedRoles);
        setRole(primaryRole);
      }
    } catch (error) {
      console.error('Erro ao carregar role:', error);
      setRole(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = roles.includes('admin');
  const isGerenteEbd = roles.includes('gerente_ebd');
  const isFinanceiro = roles.includes('financeiro');
  const canAccessAdminEBD = isAdmin || isGerenteEbd || isFinanceiro;

  return {
    role,
    roles,
    loading,
    isAdmin,
    isGerenteEbd,
    isFinanceiro,
    canAccessAdminEBD,
    refresh: loadRole,
  };
}
