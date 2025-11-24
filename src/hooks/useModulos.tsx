import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Modulo {
  id: string;
  nome_modulo: string;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export const useModulos = () => {
  return useQuery({
    queryKey: ['modulos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modulos')
        .select('*')
        .order('nome_modulo');

      if (error) throw error;
      return data as Modulo[];
    },
  });
};
