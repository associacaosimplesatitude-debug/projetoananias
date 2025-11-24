import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useActiveModules = () => {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ['active-modules', user?.id],
    queryFn: async () => {
      if (!user || role === 'admin') {
        // Admins have access to everything
        return ['REOBOTE IGREJAS', 'REOBOTE ASSOCIAÇÕES'];
      }

      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (churchError || !churchData) {
        console.error('Error fetching church:', churchError);
        return [];
      }

      const { data: assinaturas, error } = await supabase
        .from('assinaturas')
        .select(`
          status,
          modulos (
            nome_modulo
          )
        `)
        .eq('cliente_id', churchData.id)
        .eq('status', 'Ativo');

      if (error) {
        console.error('Error fetching active modules:', error);
        return [];
      }

      return assinaturas
        .map((assinatura: any) => assinatura.modulos?.nome_modulo)
        .filter(Boolean) as string[];
    },
    enabled: !!user,
  });
};
