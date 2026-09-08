import { useDashboardUserContext } from '@/hooks/useDashboardUserContext';

interface Church {
  id: string;
  church_name: string;
  process_status: string;
  current_stage: number;
}

export const useChurchData = () => {
  const { context, isLoading } = useDashboardUserContext();

  let church: Church | null = null;

  if (context) {
    if (context.church) {
      church = {
        id: context.church.id,
        church_name: context.church.church_name ?? '',
        process_status: context.church.process_status ?? 'completed',
        current_stage: context.church.current_stage ?? 0,
      };
    } else if (context.ebd_cliente) {
      church = {
        id: context.ebd_cliente.id,
        church_name: context.ebd_cliente.nome_igreja ?? '',
        process_status: 'completed',
        current_stage: 0,
      };
    } else if (context.ebd_super_role?.church_id) {
      church = {
        id: context.ebd_super_role.church_id,
        church_name: '',
        process_status: 'completed',
        current_stage: 0,
      };
    } else if (context.professor?.church_id) {
      church = {
        id: context.professor.church_id,
        church_name: '',
        process_status: 'completed',
        current_stage: 0,
      };
    } else if (context.aluno?.church_id) {
      church = {
        id: context.aluno.church_id,
        church_name: '',
        process_status: 'completed',
        current_stage: 0,
      };
    }
  }

  return { church, churchId: church?.id || null, loading: isLoading };
};
