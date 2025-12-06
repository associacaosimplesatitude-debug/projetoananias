import { Navigate } from 'react-router-dom';
import { useActiveModules } from '@/hooks/useActiveModules';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function DashboardRedirect() {
  const { data: activeModules, isLoading: modulesLoading } = useActiveModules();
  const { role, user, loading: authLoading } = useAuth();

  // Check if the user is a student - using a separate query with its own loading state
  const { data: aluno, isLoading: alunoLoading } = useQuery({
    queryKey: ["is-aluno-redirect", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Use RPC or direct query that bypasses RLS for this check
      const { data, error } = await supabase
        .from("ebd_alunos")
        .select("id, turma_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking aluno status:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id && !authLoading,
  });

  // Check if user is a professor
  const { data: professor, isLoading: professorLoading } = useQuery({
    queryKey: ["is-professor-redirect", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("ebd_professores")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking professor status:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id && !authLoading,
  });

  const isLoading = modulesLoading || alunoLoading || authLoading || professorLoading;

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

  // If user is a student, redirect to student module
  if (aluno) {
    return <Navigate to="/ebd/aluno" replace />;
  }

  // If user is a professor, redirect to EBD dashboard
  if (professor) {
    return <Navigate to="/ebd/dashboard" replace />;
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
