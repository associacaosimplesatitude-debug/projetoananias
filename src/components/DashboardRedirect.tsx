import { Navigate } from 'react-router-dom';
import { useActiveModules } from '@/hooks/useActiveModules';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function DashboardRedirect() {
  const { data: activeModules, isLoading: modulesLoading } = useActiveModules();
  const { role, user, loading: authLoading } = useAuth();

  // Check if user is a vendedor - CASE INSENSITIVE
  const { data: vendedor, isLoading: vendedorLoading } = useQuery({
    queryKey: ["is-vendedor-redirect", user?.email?.toLowerCase()],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const userEmail = user.email.toLowerCase().trim();
      
      const { data, error } = await supabase
        .from("vendedores")
        .select("id")
        .ilike("email", userEmail)
        .maybeSingle();

      if (error) {
        console.error("Error checking vendedor status:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.email && !authLoading,
  });

  // Check if user is a superintendent (from ebd_clientes)
  const { data: superintendente, isLoading: superintendenteLoading } = useQuery({
    queryKey: ["is-superintendente-redirect", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, status_ativacao_ebd")
        .eq("superintendente_user_id", user.id)
        .eq("status_ativacao_ebd", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking superintendente status:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id && !authLoading,
  });

  // Check if user is a lead de reativação (superintendent by email) - CASE INSENSITIVE
  const { data: leadReativacao, isLoading: leadLoading } = useQuery({
    queryKey: ["is-lead-reativacao-redirect", user?.email?.toLowerCase()],
    queryFn: async () => {
      if (!user?.email) return null;
      
      const userEmail = user.email.toLowerCase().trim();
      console.log('DashboardRedirect - Checking lead for email:', userEmail);
      
      const { data, error } = await supabase
        .from("ebd_leads_reativacao")
        .select("id, conta_criada, email, lead_score")
        .ilike("email", userEmail)
        .maybeSingle();

      console.log('DashboardRedirect - Lead query result:', { data, error });

      if (error) {
        console.error("Error checking lead reativacao status:", error);
        return null;
      }
      
      // If lead found, update lead_score to 'Quente' and ultimo_login_ebd
      if (data) {
        console.log('DashboardRedirect - Lead found, updating score to Quente');
        await supabase
          .from("ebd_leads_reativacao")
          .update({ 
            lead_score: 'Quente', 
            ultimo_login_ebd: new Date().toISOString(),
            conta_criada: true 
          })
          .eq("id", data.id);
      }
      
      return data;
    },
    enabled: !!user?.email && !authLoading,
  });

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

  const isLoading = modulesLoading || alunoLoading || authLoading || professorLoading || vendedorLoading || superintendenteLoading || leadLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Debug logs para identificar o problema
  console.log('DashboardRedirect - Final decision:', {
    role,
    vendedor: !!vendedor,
    superintendente: !!superintendente,
    leadReativacao: !!leadReativacao,
    leadReativacaoData: leadReativacao,
    professor: !!professor,
    aluno: !!aluno,
    activeModules,
    userEmail: user?.email
  });

  // Admins always go to admin dashboard
  if (role === 'admin') {
    console.log('DashboardRedirect - Redirecting admin to /admin');
    return <Navigate to="/admin" replace />;
  }

  // If user is a vendedor, redirect to vendedor dashboard
  if (vendedor) {
    console.log('DashboardRedirect - Redirecting vendedor to /vendedor');
    return <Navigate to="/vendedor" replace />;
  }

  // PRIORITY 1: If user is a superintendent (from ebd_clientes), redirect to EBD dashboard
  if (superintendente) {
    console.log('DashboardRedirect - Redirecting superintendente to /ebd/dashboard');
    return <Navigate to="/ebd/dashboard" replace />;
  }

  // PRIORITY 2: If user is a lead de reativação (superintendente by email), redirect to EBD dashboard
  if (leadReativacao) {
    console.log('DashboardRedirect - Redirecting lead reativacao to /ebd/dashboard');
    return <Navigate to="/ebd/dashboard" replace />;
  }

  // PRIORITY 3: If user is a professor, redirect to Professor module
  if (professor) {
    return <Navigate to="/ebd/professor" replace />;
  }

  // PRIORITY 4: If user is a student, redirect to student module
  if (aluno) {
    return <Navigate to="/ebd/aluno" replace />;
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
