import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardUserContext } from '@/hooks/useDashboardUserContext';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardRedirect() {
  const { role } = useAuth();
  const { context, isLoading, error, refetch } = useDashboardUserContext();

  const leadId = context?.lead_reativacao?.id;

  // Mantém o comportamento atual: ao entrar, o lead vira "Quente"
  useEffect(() => {
    if (!leadId) return;
    supabase
      .from('ebd_leads_reativacao')
      .update({
        lead_score: 'Quente',
        ultimo_login_ebd: new Date().toISOString(),
        conta_criada: true,
      })
      .eq('id', leadId)
      .then(({ error: updateError }) => {
        if (updateError) console.error('Erro ao atualizar lead:', updateError);
      });
  }, [leadId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-muted-foreground">Não foi possível carregar seus dados. Tente novamente.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const activeModules = context.active_modules;

  // Admins always go to admin dashboard
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (role === 'gerente_royalties') {
    return <Navigate to="/royalties" replace />;
  }

  if (role === 'autor') {
    return <Navigate to="/autor" replace />;
  }

  if (role === 'gerente_ebd') {
    return <Navigate to="/admin/ebd" replace />;
  }

  if (role === 'financeiro') {
    return <Navigate to="/admin/ebd/aprovacao-faturamento" replace />;
  }

  if (role === 'gerente_sorteio') {
    return <Navigate to="/admin/ebd/sorteio" replace />;
  }

  // Vendedor
  if (context.is_vendedor) {
    return <Navigate to="/vendedor" replace />;
  }

  // PRIORITY 1: REVENDEDOR
  if (context.ebd_cliente?.tipo_cliente === 'REVENDEDOR') {
    return <Navigate to="/ebd/shopify-pedidos" replace />;
  }

  // PRIORITY 2: superintendente (ebd_clientes OU ebd_user_roles)
  if (context.ebd_cliente || context.ebd_super_role) {
    return <Navigate to="/ebd/dashboard" replace />;
  }

  // PRIORITY 2: lead de reativação
  if (context.is_lead_reativacao) {
    return <Navigate to="/ebd/dashboard" replace />;
  }

  // PRIORITY 3: professor
  if (context.is_professor) {
    return <Navigate to="/ebd/professor" replace />;
  }

  // PRIORITY 4: aluno
  if (context.is_aluno) {
    return <Navigate to="/ebd/aluno" replace />;
  }

  if (activeModules?.length === 1 && activeModules.includes('REOBOTE EBD')) {
    return <Navigate to="/ebd/dashboard" replace />;
  }

  if (activeModules?.includes('REOBOTE IGREJAS')) {
    return <Navigate to="/dashboard" replace />;
  }

  if (activeModules?.includes('REOBOTE EBD')) {
    return <Navigate to="/ebd/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
