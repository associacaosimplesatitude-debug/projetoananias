import { Navigate } from 'react-router-dom';
import { useActiveModules } from '@/hooks/useActiveModules';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardRedirect() {
  const { data: activeModules, isLoading } = useActiveModules();
  const { role } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Admins always go to admin dashboard
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  // If user has only REOBOTE EBD, redirect to EBD dashboard
  if (activeModules?.length === 1 && activeModules.includes('REOBOTE EBD')) {
    return <Navigate to="/ebd/dashboard" replace />;
  }

  // If user has REOBOTE IGREJAS (alone or with other modules), redirect to financial dashboard
  if (activeModules?.includes('REOBOTE IGREJAS')) {
    return <Navigate to="/dashboard" replace />;
  }

  // Default to EBD if they have it
  if (activeModules?.includes('REOBOTE EBD')) {
    return <Navigate to="/ebd/dashboard" replace />;
  }

  // Fallback to dashboard
  return <Navigate to="/dashboard" replace />;
}
