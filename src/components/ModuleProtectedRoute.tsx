import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useActiveModules } from '@/hooks/useActiveModules';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
  requiredModule: string;
}

export default function ModuleProtectedRoute({ children, requiredModule }: ModuleProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const { data: activeModules, isLoading: modulesLoading } = useActiveModules();

  // Check if user is a student - this bypasses module check for EBD routes
  const { data: isStudent, isLoading: studentLoading } = useQuery({
    queryKey: ['is-student-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('ebd_alunos')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error checking student status:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user?.id && !loading,
  });

  // Check if user is a professor
  const { data: isProfessor, isLoading: professorLoading } = useQuery({
    queryKey: ['is-professor-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('ebd_professores')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error checking professor status:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user?.id && !loading,
  });

  // Check if user is a vendedor
  const { data: isVendedor, isLoading: vendedorLoading } = useQuery({
    queryKey: ['is-vendedor-check', user?.email],
    queryFn: async () => {
      if (!user?.email) return false;
      
      const { data, error } = await supabase
        .from('vendedores')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();

      if (error) {
        console.error('Error checking vendedor status:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user?.email && !loading,
  });

  // Check if user is a superintendent (from ebd_clientes)
  const { data: isSuperintendente, isLoading: superintendenteLoading } = useQuery({
    queryKey: ['is-superintendente-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('ebd_clientes')
        .select('id')
        .eq('superintendente_user_id', user.id)
        .eq('status_ativacao_ebd', true)
        .maybeSingle();

      if (error) {
        console.error('Error checking superintendente status:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user?.id && !loading,
  });

  // Check if user is a lead de reativação
  const { data: isLeadReativacao, isLoading: leadLoading } = useQuery({
    queryKey: ['is-lead-reativacao-check', user?.email],
    queryFn: async () => {
      if (!user?.email) return false;
      
      const { data, error } = await supabase
        .from('ebd_leads_reativacao')
        .select('id')
        .eq('email', user.email)
        .eq('conta_criada', true)
        .maybeSingle();

      if (error) {
        console.error('Error checking lead reativacao status:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!user?.email && !loading,
  });

  const isLoading = loading || modulesLoading || studentLoading || professorLoading || vendedorLoading || superintendenteLoading || leadLoading;

  if (isLoading) {
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

  // Vendedores have access to EBD routes (carrinho, checkout, etc.)
  if (isVendedor && requiredModule === 'REOBOTE EBD') {
    return <>{children}</>;
  }

  // Superintendents have access to EBD routes
  if (isSuperintendente && requiredModule === 'REOBOTE EBD') {
    return <>{children}</>;
  }

  // Leads de reativação have access to EBD routes
  if (isLeadReativacao && requiredModule === 'REOBOTE EBD') {
    return <>{children}</>;
  }

  // Students have access to EBD routes
  if (isStudent && requiredModule === 'REOBOTE EBD') {
    return <>{children}</>;
  }

  // Professors have access to EBD routes
  if (isProfessor && requiredModule === 'REOBOTE EBD') {
    return <>{children}</>;
  }

  // Check if user has the required module active
  if (!activeModules?.includes(requiredModule)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
