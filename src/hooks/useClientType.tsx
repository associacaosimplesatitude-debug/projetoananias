import { useDashboardUserContext } from '@/hooks/useDashboardUserContext';

export const useClientType = () => {
  const { context, isLoading } = useDashboardUserContext();

  const clientType = (context?.church?.client_type as 'igreja' | 'associacao' | undefined) ?? null;

  return { clientType, loading: isLoading };
};
