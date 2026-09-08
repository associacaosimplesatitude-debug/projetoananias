import React from 'react';
import { useLocation } from 'react-router-dom';
import { Navigation } from '@/components/layout/Navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardUserContext } from '@/hooks/useDashboardUserContext';

interface ConditionalNavigationProps {
  children: React.ReactNode;
}

export function ConditionalNavigation({ children }: ConditionalNavigationProps) {
  const location = useLocation();
  const { role } = useAuth();
  const { context } = useDashboardUserContext();
  const isGerenteEbd = role === 'gerente_ebd';
  const isFinanceiro = role === 'financeiro';

  const isAluno = !!context?.is_aluno;
  const isProfessor = !!context?.is_professor;
  const isVendedor = !!context?.is_vendedor;

  // Check if we're on aluno, professor, vendedor, admin or admin EBD routes
  const isAlunoRoute = location.pathname.startsWith('/ebd/aluno');
  const isProfessorRoute = location.pathname.startsWith('/ebd/professor');
  const isVendedorRoute = location.pathname.startsWith('/vendedor');
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminEbdRoute = location.pathname.startsWith('/admin/ebd');
  const isRoyaltiesRoute = location.pathname.startsWith('/royalties');
  const isAutorRoute = location.pathname.startsWith('/autor');

  // EBD superintendent routes (with sidebar layout)
  const isEbdSuperintendentRoute = location.pathname.startsWith('/ebd/') &&
    !isAlunoRoute &&
    !isProfessorRoute;

  const shouldHideNavigation =
    (isAluno && isAlunoRoute) ||
    (isProfessor && isProfessorRoute) ||
    (isVendedor && isVendedorRoute) ||
    (role === 'admin' && isAdminRoute) ||
    (isGerenteEbd && isAdminEbdRoute) ||
    (isFinanceiro && isAdminEbdRoute) ||
    isEbdSuperintendentRoute ||
    isRoyaltiesRoute ||
    isAutorRoute;

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
