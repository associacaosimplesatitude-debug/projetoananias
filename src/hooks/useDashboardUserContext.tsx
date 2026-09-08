import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DashboardUserContext {
  authenticated: boolean;
  user_id: string | null;
  email: string | null;
  is_admin: boolean;
  is_vendedor: boolean;
  vendedor: { id: string; email: string } | null;
  is_superintendente: boolean;
  ebd_cliente: {
    id: string;
    status_ativacao_ebd: boolean | null;
    tipo_cliente: string | null;
    nome_igreja: string | null;
  } | null;
  ebd_super_role: { id: string; church_id: string | null } | null;
  is_lead_reativacao: boolean;
  lead_reativacao: {
    id: string;
    email: string | null;
    conta_criada: boolean | null;
    lead_score: string | null;
  } | null;
  is_aluno: boolean;
  aluno: { id: string; turma_id: string | null; church_id: string | null } | null;
  is_professor: boolean;
  professor: { id: string; church_id: string | null } | null;
  church: {
    id: string;
    church_name: string | null;
    process_status: string | null;
    current_stage: number | null;
    client_type: string | null;
  } | null;
  profile: { avatar_url: string | null; full_name: string | null; church_id: string | null } | null;
  active_modules: string[];
}

const EMPTY_CONTEXT: DashboardUserContext = {
  authenticated: false,
  user_id: null,
  email: null,
  is_admin: false,
  is_vendedor: false,
  vendedor: null,
  is_superintendente: false,
  ebd_cliente: null,
  ebd_super_role: null,
  is_lead_reativacao: false,
  lead_reativacao: null,
  is_aluno: false,
  aluno: null,
  is_professor: false,
  professor: null,
  church: null,
  profile: null,
  active_modules: [],
};

/**
 * Consulta única e compartilhada (cache React Query) com todos os vínculos
 * do usuário logado. Substitui as ~20 queries independentes que existiam.
 */
export function useDashboardUserContext() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['dashboard-user-context', user?.id],
    queryFn: async (): Promise<DashboardUserContext> => {
      const { data, error } = await (supabase as any).rpc('get_dashboard_user_context');
      if (error) throw error;
      return { ...EMPTY_CONTEXT, ...((data || {}) as Partial<DashboardUserContext>) };
    },
    enabled: !!user?.id && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return {
    context: query.data ?? (user ? undefined : EMPTY_CONTEXT),
    isLoading: authLoading || (!!user?.id && query.isLoading),
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
