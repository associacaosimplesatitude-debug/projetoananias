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
