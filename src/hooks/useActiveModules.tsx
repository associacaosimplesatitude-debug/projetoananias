import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useActiveModules = () => {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ['active-modules', user?.id, user?.email],
    queryFn: async () => {
      if (!user) return [];
      
      if (role === 'admin') {
        // Admins have access to everything
        return ['REOBOTE IGREJAS', 'REOBOTE ASSOCIAÇÕES', 'REOBOTE EBD'];
      }

      // Check if user is a vendedor - they have access to EBD module
      if (user.email) {
        const { data: vendedorData } = await supabase
          .from('vendedores')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();

        if (vendedorData) {
          // Vendedores have access to EBD module
          return ['REOBOTE EBD'];
        }
      }

      // Check if user is a superintendent (from ebd_clientes)
      const { data: superintendenteData } = await supabase
        .from('ebd_clientes')
        .select('id, status_ativacao_ebd')
        .eq('superintendente_user_id', user.id)
        .eq('status_ativacao_ebd', true)
        .maybeSingle();

      if (superintendenteData) {
        // Superintendents have access to EBD module
        return ['REOBOTE EBD'];
      }

      // Check if user is a lead de reativação (by email) - CASE INSENSITIVE
      if (user.email) {
        const userEmail = user.email.toLowerCase().trim();
        const { data: leadData } = await supabase
          .from('ebd_leads_reativacao')
          .select('id')
          .ilike('email', userEmail)
          .maybeSingle();

        if (leadData) {
          console.log('useActiveModules: User is a lead de reativação, granting EBD access');
          return ['REOBOTE EBD'];
        }
      }

      // First, try to find church where user is the owner
      let churchId: string | null = null;

      const { data: churchData } = await supabase
        .from('churches')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (churchData) {
        churchId = churchData.id;
      } else {
        // If not a church owner, check if user is a student (aluno)
        const { data: alunoData } = await supabase
          .from('ebd_alunos')
          .select('church_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (alunoData) {
          churchId = alunoData.church_id;
        } else {
          // Check if user is a professor
          const { data: professorData } = await supabase
            .from('ebd_professores')
            .select('church_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          if (professorData) {
            churchId = professorData.church_id;
          }
        }
      }

      if (!churchId) {
        console.log('No church found for user');
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
        .eq('cliente_id', churchId)
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
