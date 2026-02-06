import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'admin' | 'client' | 'tesoureiro' | 'secretario' | 'gerente_ebd' | 'representante' | 'financeiro' | 'autor' | 'gerente_royalties';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadRole();
    } else {
      setRole(null);
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
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('Role não encontrada:', error.message);
        setRole(null);
      } else {
        setRole(data?.role as AppRole || null);
      }
    } catch (error) {
      console.error('Erro ao carregar role:', error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = role === 'admin';
  const isGerenteEbd = role === 'gerente_ebd';
  const isFinanceiro = role === 'financeiro';
  const canAccessAdminEBD = isAdmin || isGerenteEbd || isFinanceiro;

  return {
    role,
    loading,
    isAdmin,
    isGerenteEbd,
    isFinanceiro,
    canAccessAdminEBD,
    refresh: loadRole,
  };
}
