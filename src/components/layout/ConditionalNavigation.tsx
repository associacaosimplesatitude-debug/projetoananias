import React from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Navigation } from '@/components/layout/Navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ConditionalNavigationProps {
  children: React.ReactNode;
}

export function ConditionalNavigation({ children }: ConditionalNavigationProps) {
  const location = useLocation();
  const { user, role } = useAuth();
  const isGerenteEbd = role === 'gerente_ebd';

  // Check if current user is a student
  const { data: isAluno } = useQuery({
    queryKey: ["is-aluno-conditional", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from("ebd_alunos")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) return false;
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Check if current user is a professor
  const { data: isProfessor } = useQuery({
    queryKey: ["is-professor-conditional", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from("ebd_professores")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) return false;
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Check if current user is a vendedor
  const { data: isVendedor } = useQuery({
    queryKey: ["is-vendedor-conditional", user?.email],
    queryFn: async () => {
      if (!user?.email) return false;
      const { data, error } = await supabase
        .from("vendedores")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      
      if (error) return false;
      return !!data;
    },
    enabled: !!user?.email,
  });

  // Check if we're on aluno, professor, vendedor or admin EBD routes
  const isAlunoRoute = location.pathname.startsWith('/ebd/aluno');
  const isProfessorRoute = location.pathname.startsWith('/ebd/professor');
  const isVendedorRoute = location.pathname.startsWith('/vendedor');
  const isAdminEbdRoute = location.pathname.startsWith('/admin/ebd');
 
  // Hide main navigation if:
  // 1. User is aluno and on aluno routes
  // 2. User is professor and on professor routes
  // 3. User is vendedor and on vendedor routes
  // 4. User is gerente EBD and on admin EBD routes
  const shouldHideNavigation = 
    (isAluno && isAlunoRoute) || 
    (isProfessor && isProfessorRoute) ||
    (isVendedor && isVendedorRoute) ||
    (isGerenteEbd && isAdminEbdRoute);

  if (shouldHideNavigation) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      {children}
    </>
  );
}
