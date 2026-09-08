import { useDashboardUserContext } from '@/hooks/useDashboardUserContext';

export const useActiveModules = () => {
  const { context, isLoading, error, refetch } = useDashboardUserContext();

  return {
    data: context?.active_modules ?? (isLoading ? undefined : []),
    isLoading,
    error,
    refetch,
  };
};
