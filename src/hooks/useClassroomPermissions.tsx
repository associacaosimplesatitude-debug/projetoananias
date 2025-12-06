import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type TipoResponsavel = 'Secretario' | 'Professor' | 'Aluno';

interface Turma {
  id: string;
  nome: string;
  responsavel_chamada: TipoResponsavel;
  responsavel_dados_aula: TipoResponsavel;
  responsavel_pontuacao: TipoResponsavel;
  permite_lancamento_ofertas: boolean;
  permite_lancamento_revistas: boolean;
  permite_lancamento_biblias: boolean;
}

interface UseClassroomPermissionsProps {
  turmaId?: string;
  churchId?: string;
}

export function useClassroomPermissions({ turmaId, churchId }: UseClassroomPermissionsProps) {
  const { user } = useAuth();

  // Buscar dados da turma
  const { data: turma, isLoading: loadingTurma } = useQuery({
    queryKey: ['ebd-turma-permissions', turmaId],
    queryFn: async () => {
      if (!turmaId) return null;
      
      const { data, error } = await supabase
        .from('ebd_turmas')
        .select('id, nome, responsavel_chamada, responsavel_dados_aula, responsavel_pontuacao, permite_lancamento_ofertas, permite_lancamento_revistas, permite_lancamento_biblias')
        .eq('id', turmaId)
        .single();

      if (error) throw error;
      return data as Turma;
    },
    enabled: !!turmaId,
  });

  // Verificar se o usuário é professor desta turma
  const { data: isProfessor, isLoading: loadingProfessor } = useQuery({
    queryKey: ['ebd-user-is-professor', turmaId, user?.id],
    queryFn: async () => {
      if (!turmaId || !user?.id) return false;

      // Primeiro, buscar o professor vinculado ao user_id
      const { data: professor } = await supabase
        .from('ebd_professores')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!professor) return false;

      // Verificar se o professor está vinculado à turma
      const { data: vinculo } = await supabase
        .from('ebd_professores_turmas')
        .select('id')
        .eq('professor_id', professor.id)
        .eq('turma_id', turmaId)
        .maybeSingle();

      return !!vinculo;
    },
    enabled: !!turmaId && !!user?.id,
  });

  // Verificar se o usuário é aluno desta turma
  const { data: isAluno, isLoading: loadingAluno } = useQuery({
    queryKey: ['ebd-user-is-aluno', turmaId, user?.id],
    queryFn: async () => {
      if (!turmaId || !user?.id) return false;

      const { data } = await supabase
        .from('ebd_alunos')
        .select('id')
        .eq('user_id', user.id)
        .eq('turma_id', turmaId)
        .eq('is_active', true)
        .maybeSingle();

      return !!data;
    },
    enabled: !!turmaId && !!user?.id,
  });

  // Verificar se o usuário é superintendente (dono da igreja)
  const { data: isSuperintendente, isLoading: loadingSuperintendente } = useQuery({
    queryKey: ['ebd-user-is-superintendente', churchId, user?.id],
    queryFn: async () => {
      if (!churchId || !user?.id) return false;

      const { data } = await supabase
        .from('churches')
        .select('id')
        .eq('id', churchId)
        .eq('user_id', user.id)
        .maybeSingle();

      return !!data;
    },
    enabled: !!churchId && !!user?.id,
  });

  // Verificar se o usuário é secretário (tem permissão de manage_members ou similar)
  const { data: isSecretario, isLoading: loadingSecretario } = useQuery({
    queryKey: ['ebd-user-is-secretario', churchId, user?.id],
    queryFn: async () => {
      if (!churchId || !user?.id) return false;

      // Verificar se tem alguma permissão de secretário
      const { data } = await supabase
        .from('church_member_permissions')
        .select('id')
        .eq('church_id', churchId)
        .eq('user_id', user.id)
        .in('permission', ['manage_members', 'view_reports'])
        .maybeSingle();

      return !!data;
    },
    enabled: !!churchId && !!user?.id,
  });

  const loading = loadingTurma || loadingProfessor || loadingAluno || loadingSuperintendente || loadingSecretario;

  // Calcular permissões baseadas na configuração da turma
  const permissions = useMemo(() => {
    if (!turma) {
      return {
        canRegisterChamada: false,
        canRegisterDadosAula: false,
        canRegisterPontuacao: false,
      };
    }

    // Superintendente sempre pode fazer tudo
    if (isSuperintendente) {
      return {
        canRegisterChamada: true,
        canRegisterDadosAula: true,
        canRegisterPontuacao: true,
      };
    }

    const canRegisterChamada = 
      (turma.responsavel_chamada === 'Professor' && isProfessor) ||
      (turma.responsavel_chamada === 'Aluno' && isAluno) ||
      (turma.responsavel_chamada === 'Secretario' && isSecretario);

    const canRegisterDadosAula = 
      (turma.responsavel_dados_aula === 'Professor' && isProfessor) ||
      (turma.responsavel_dados_aula === 'Secretario' && isSecretario);

    const canRegisterPontuacao = 
      (turma.responsavel_pontuacao === 'Professor' && isProfessor);

    return {
      canRegisterChamada,
      canRegisterDadosAula,
      canRegisterPontuacao,
    };
  }, [turma, isProfessor, isAluno, isSecretario, isSuperintendente]);

  return {
    turma,
    isProfessor: isProfessor || false,
    isAluno: isAluno || false,
    isSecretario: isSecretario || false,
    isSuperintendente: isSuperintendente || false,
    loading,
    ...permissions,
  };
}
