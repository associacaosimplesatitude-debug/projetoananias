import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useActiveModules } from '@/hooks/useActiveModules';

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
  requiredModule: string;
}

export default function ModuleProtectedRoute({ children, requiredModule }: ModuleProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const { data: activeModules, isLoading: modulesLoading } = useActiveModules();

  if (loading || modulesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admins have access to everything
  if (role === 'admin') {
    return <>{children}</>;
  }

  // Check if user has the required module active
  if (!activeModules?.includes(requiredModule)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
