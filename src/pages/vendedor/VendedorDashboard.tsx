import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  AlertTriangle, 
  Gift,
  Clock,
  DollarSign,
  Target,
  UserPlus,
} from "lucide-react";
import { format, isThisMonth, parseISO, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { useState } from "react";
import { CadastrarClienteDialog } from "@/components/vendedor/CadastrarClienteDialog";
import { LeadScoringKPIs } from "@/components/leads/LeadScoringKPIs";
import { useVendedor } from "@/hooks/useVendedor";

export default function VendedorDashboard() {
  const { vendedor, isLoading: vendedorLoading, refetch } = useVendedor();
  const [cadastrarClienteOpen, setCadastrarClienteOpen] = useState(false);

  const { data: clientes = [], isLoading: clientesLoading } = useQuery({
    queryKey: ["vendedor-clientes", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("*")
        .eq("vendedor_id", vendedor.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!vendedor?.id,
  });

  const { data: vendasMes = 0 } = useQuery({
    queryKey: ["vendedor-vendas-mes", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return 0;
      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id")
        .eq("vendedor_id", vendedor.id)
        .eq("status_ativacao_ebd", true)
        .gte("data_inicio_ebd", inicioMes)
        .lte("data_inicio_ebd", fimMes);
      if (error) return 0;
      return (data?.length || 0) * 500;
    },
    enabled: !!vendedor?.id,
  });

  const loading = vendedorLoading || clientesLoading;

  const clientesPendentes = clientes.filter(c => !c.status_ativacao_ebd);
  const clientesAtivos = clientes.filter(c => c.status_ativacao_ebd);

  const aniversariantes = clientes.filter(c => {
    const pastorBday = c.data_aniversario_pastor ? parseISO(c.data_aniversario_pastor) : null;
    const supBday = c.data_aniversario_superintendente ? parseISO(c.data_aniversario_superintendente) : null;
    return (pastorBday && isThisMonth(pastorBday)) || (supBday && isThisMonth(supBday));
  });

  const clientesRisco = clientesAtivos.filter(c => {
    if (!c.ultimo_login) return true;
    const diasSemLogin = differenceInDays(new Date(), new Date(c.ultimo_login));
    return diasSemLogin > 30;
  });

  const comissaoMes = vendasMes * ((vendedor?.comissao_percentual || 0) / 100);
  const metaMensal = vendedor?.meta_mensal_valor || 0;
  const progressoMeta = metaMensal > 0 ? Math.min((vendasMes / metaMensal) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!vendedor) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Painel do Vendedor</h2>
          <p className="text-muted-foreground">
            Você ainda não está cadastrado como vendedor no sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">
            Bem-vindo, {vendedor?.nome}
          </p>
        </div>
        <Button onClick={() => setCadastrarClienteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {/* KPIs - Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientes.length}</div>
            <p className="text-xs text-muted-foreground">
              {clientesAtivos.length} ativos, {clientesPendentes.length} pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes de Ativação</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesPendentes.length}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando ativação do Painel EBD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aniversariantes</CardTitle>
            <Gift className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aniversariantes.length}</div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes em Risco</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientesRisco.length}</div>
            <p className="text-xs text-muted-foreground">
              Sem login há mais de 30 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs - Row 2: Sales */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Comissão Acumulada no Mês
            </CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300">
              R$ {comissaoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Vendas do mês: R$ {vendasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} 
              × {vendedor?.comissao_percentual || 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Progresso da Meta
            </CardTitle>
            <Target className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {progressoMeta.toFixed(1)}%
              </span>
              <span className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                da meta
              </span>
            </div>
            <Progress value={progressoMeta} className="h-3 bg-blue-100 dark:bg-blue-900" />
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              R$ {vendasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de R$ {metaMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Scoring KPIs */}
      <LeadScoringKPIs vendedorId={vendedor.id} />

      {/* Cadastrar Cliente Dialog */}
      <CadastrarClienteDialog
        open={cadastrarClienteOpen}
        onOpenChange={setCadastrarClienteOpen}
        vendedorId={vendedor?.id || ""}
        onSuccess={refetch}
        clienteParaEditar={null}
      />
    </div>
  );
}
