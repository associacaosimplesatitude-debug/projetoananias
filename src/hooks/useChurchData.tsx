import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Church {
  id: string;
  church_name: string;
  process_status: string;
  current_stage: number;
}

export const useChurchData = () => {
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChurchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log('No user found');
          setLoading(false);
          return;
        }

        // 1. Try churches table
        const { data: churchData, error } = await supabase
          .from('churches')
          .select('id, church_name, process_status, current_stage')
          .eq('user_id', user.id)
          .maybeSingle();

        if (churchData) {
          console.log('Church found:', churchData.id);
          setChurch(churchData);
          setLoading(false);
          return;
        }

        // 2. Try ebd_clientes as superintendent
        const { data: clienteData } = await supabase
          .from('ebd_clientes')
          .select('id, nome_igreja')
          .eq('superintendente_user_id', user.id)
          .maybeSingle();

        if (clienteData) {
          console.log('EBD Cliente found:', clienteData.id);
          setChurch({
            id: clienteData.id,
            church_name: clienteData.nome_igreja,
            process_status: 'completed',
            current_stage: 0,
          });
          setLoading(false);
          return;
        }

        // 2.1 Try ebd_user_roles as promoted superintendent
        const { data: superRoleData } = await supabase
          .from('ebd_user_roles')
          .select('church_id')
          .eq('user_id', user.id)
          .eq('role', 'superintendente')
          .limit(1);

        if (superRoleData && superRoleData.length > 0) {
          const roleChurchId = superRoleData[0].church_id;
          console.log('EBD Superintendent role found for church:', roleChurchId);

          // For promoted superintendents, church_id points to `churches.id`
          const { data: roleChurch } = await supabase
            .from('churches')
            .select('id, church_name, process_status, current_stage')
            .eq('id', roleChurchId)
            .maybeSingle();

          setChurch(
            roleChurch
              ? {
                  id: roleChurch.id,
                  church_name: roleChurch.church_name,
                  process_status: roleChurch.process_status,
                  current_stage: roleChurch.current_stage ?? 0,
                }
              : {
                  id: roleChurchId,
                  church_name: '',
                  process_status: 'completed',
                  current_stage: 0,
                }
          );
          setLoading(false);
          return;
        }
        // 3. Try via professor (find church_id from professor record)
        const { data: professorData } = await supabase
          .from('ebd_professores')
          .select('church_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (professorData?.church_id) {
          console.log('Church found via professor:', professorData.church_id);
          setChurch({
            id: professorData.church_id,
            church_name: '',
            process_status: 'completed',
            current_stage: 0,
          });
          setLoading(false);
          return;
        }

        // 4. Try via aluno
        const { data: alunoData } = await supabase
          .from('ebd_alunos')
          .select('church_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (alunoData?.church_id) {
          console.log('Church found via aluno:', alunoData.church_id);
          setChurch({
            id: alunoData.church_id,
            church_name: '',
            process_status: 'completed',
            current_stage: 0,
          });
          setLoading(false);
          return;
        }

        console.log('No church found for user');
      } catch (error) {
        console.error('Error fetching church data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChurchData();
  }, []);

  return { church, churchId: church?.id || null, loading };
};
