import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Assinatura {
  id: string;
  cliente_id: string;
  modulo_id: string;
  status: 'Ativo' | 'Pendente' | 'Inativo';
  data_ativacao: string;
  created_at: string;
  updated_at: string;
}

export const useAssinaturas = (clienteId?: string) => {
  return useQuery({
    queryKey: ['assinaturas', clienteId],
    queryFn: async () => {
      let query = supabase
        .from('assinaturas')
        .select(`
          *,
          modulos (
            id,
            nome_modulo,
            descricao
          )
        `);

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });
};

export const useCreateAssinaturas = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clienteId, moduloIds }: { clienteId: string; moduloIds: string[] }) => {
      const assinaturas = moduloIds.map(moduloId => ({
        cliente_id: clienteId,
        modulo_id: moduloId,
        status: 'Ativo' as const,
      }));

      const { data, error } = await supabase
        .from('assinaturas')
        .insert(assinaturas)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      toast.success('Módulos ativados com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao ativar módulos: ' + error.message);
    },
  });
};

export const useUpdateAssinatura = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'Ativo' | 'Inativo' }) => {
      const { data, error } = await supabase
        .from('assinaturas')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      toast.success('Status do módulo atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar módulo: ' + error.message);
    },
  });
};

export const useDeleteAssinatura = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('assinaturas')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      toast.success('Módulo removido com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover módulo: ' + error.message);
    },
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      // Deletar todas as tabelas relacionadas em ordem (evitar violações de foreign key)
      
      // 1. Deletar permissões de membros da igreja
      await supabase
        .from('church_member_permissions')
        .delete()
        .eq('church_id', clientId);

      // 2. Deletar membros da igreja
      await supabase
        .from('church_members')
        .delete()
        .eq('church_id', clientId);

      // 3. Deletar lançamentos contábeis
      await supabase
        .from('lancamentos_contabeis')
        .delete()
        .eq('church_id', clientId);

      // 4. Deletar entradas financeiras
      await supabase
        .from('financial_entries')
        .delete()
        .eq('church_id', clientId);

      // 5. Deletar despesas financeiras
      await supabase
        .from('financial_expenses')
        .delete()
        .eq('church_id', clientId);

      // 6. Deletar contas a pagar
      await supabase
        .from('bills_to_pay')
        .delete()
        .eq('church_id', clientId);

      // 7. Deletar despesas recorrentes
      await supabase
        .from('recurring_expenses')
        .delete()
        .eq('church_id', clientId);

      // 8. Deletar contas bancárias
      await supabase
        .from('bank_accounts')
        .delete()
        .eq('church_id', clientId);

      // 9. Deletar contas a receber
      await supabase
        .from('accounts_receivable')
        .delete()
        .eq('church_id', clientId);

      // 10. Deletar documentos da igreja
      await supabase
        .from('church_documents')
        .delete()
        .eq('church_id', clientId);

      // 11. Deletar progresso do funil
      await supabase
        .from('church_stage_progress')
        .delete()
        .eq('church_id', clientId);

      // 12. Deletar pagamentos variáveis
      await supabase
        .from('variable_payments')
        .delete()
        .eq('church_id', clientId);

      // 13. Deletar membros da diretoria
      await supabase
        .from('board_members')
        .delete()
        .eq('church_id', clientId);

      // 14. Deletar mandatos
      await supabase
        .from('board_mandates')
        .delete()
        .eq('church_id', clientId);

      // 15. Deletar assinaturas de módulos
      const { error: assinaturasError } = await supabase
        .from('assinaturas')
        .delete()
        .eq('cliente_id', clientId);

      if (assinaturasError) throw assinaturasError;

      // 16. Por fim, deletar o cliente
      const { error: clientError } = await supabase
        .from('churches')
        .delete()
        .eq('id', clientId);

      if (clientError) throw clientError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      queryClient.invalidateQueries({ queryKey: ['assinaturas'] });
      toast.success('Cliente e todos os dados relacionados foram excluídos com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir cliente: ' + error.message);
    },
  });
};
