import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  AlertTriangle, 
  Gift,
  Clock,
  DollarSign,
  Target,
  UserPlus,
  Church,
  Building2,
  Store,
  Handshake,
  User,
  ShoppingBag,
  ShoppingCart,
  Eye,
  Package,
} from "lucide-react";
import { format, isThisMonth, parseISO, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CadastrarClienteDialog } from "@/components/vendedor/CadastrarClienteDialog";
// LeadScoringKPIs ocultado conforme solicitação
// import { LeadScoringKPIs } from "@/components/leads/LeadScoringKPIs";
import { AulasRestantesCard } from "@/components/vendedor/AulasRestantesCard";
import { ClientesParaAtivarCard } from "@/components/vendedor/ClientesParaAtivarCard";
import { AniversariantesCard } from "@/components/ebd/AniversariantesCard";
import { useVendedor } from "@/hooks/useVendedor";

export default function VendedorDashboard() {
  const navigate = useNavigate();
  const { vendedor, isVendedor, isRepresentante, isLoading: vendedorLoading, refetch } = useVendedor();
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

  // Fetch últimos pedidos para o representante
  const { data: ultimosPedidos = [] } = useQuery({
    queryKey: ["vendedor-ultimos-pedidos", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return [];
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .select("id, cliente_id, valor_total, created_at, status")
        .eq("vendedor_id", vendedor.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      
      // Buscar nomes dos clientes
      const clienteIds = data.map(p => p.cliente_id).filter(Boolean);
      if (clienteIds.length === 0) return data.map(p => ({ ...p, cliente_nome: "—" }));
      
      const { data: clientesData } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .in("id", clienteIds);
      
      const clienteMap = new Map(clientesData?.map(c => [c.id, c.nome_igreja]) || []);
      
      return data.map(p => ({
        ...p,
        cliente_nome: clienteMap.get(p.cliente_id) || "—"
      }));
    },
    enabled: !!vendedor?.id && isRepresentante,
  });

  // Fetch Shopify orders for this vendedor in current month (includes todas as vendas válidas)
  const { data: vendasMes = 0 } = useQuery({
    queryKey: ["vendedor-vendas-mes", vendedor?.id],
    queryFn: async () => {
      if (!vendedor?.id) return 0;
      const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd'T'00:00:00");
      const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd'T'23:59:59");
      
      // Buscar pedidos Shopify (qualquer status exceto reembolsado) do mês atual
      const { data: shopifyOrders, error: shopifyError } = await supabase
        .from("ebd_shopify_pedidos")
        .select("valor_para_meta, status_pagamento")
        .eq("vendedor_id", vendedor.id)
        .neq("status_pagamento", "Reembolsado")
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes);
      
      if (shopifyError) {
        console.error("Error fetching shopify orders:", shopifyError);
      }
      
      // Buscar propostas faturadas do mês atual
      const { data: propostasFaturadas, error: propostasError } = await supabase
        .from("vendedor_propostas")
        .select("valor_total, valor_frete")
        .eq("vendedor_id", vendedor.id)
        .in("status", ["FATURADO", "PAGO"])
        .gte("created_at", inicioMes)
        .lte("created_at", fimMes);
      
      if (propostasError) {
        console.error("Error fetching propostas faturadas:", propostasError);
      }
      
      // Somar valor_para_meta de todos os pedidos válidos (Pago, Faturado, etc.)
      const totalShopify = (shopifyOrders || []).reduce((sum, order) => 
        sum + Number(order.valor_para_meta || 0), 0
      );
      
      // Somar valor das propostas faturadas (valor_total - valor_frete)
      const totalPropostas = (propostasFaturadas || []).reduce((sum, proposta) => 
        sum + (Number(proposta.valor_total || 0) - Number(proposta.valor_frete || 0)), 0
      );
      
      return totalShopify + totalPropostas;
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

  // Contagem por tipo de cliente (tipos padronizados)
  const clientesPorTipo = {
    advecs: clientes.filter(c => c.tipo_cliente === "ADVECS" || c.tipo_cliente === "IGREJA ADVECS").length,
    igrejaCnpj: clientes.filter(c => c.tipo_cliente === "IGREJA CNPJ" || c.tipo_cliente === "Igreja CNPJ").length,
    igrejaCpf: clientes.filter(c => c.tipo_cliente === "IGREJA CPF" || c.tipo_cliente === "Igreja CPF").length,
    lojista: clientes.filter(c => c.tipo_cliente === "LOJISTA" || c.tipo_cliente === "VAREJO" || c.tipo_cliente === "LIVRARIA").length,
    representante: clientes.filter(c => c.tipo_cliente === "REPRESENTANTE").length,
    pessoaFisica: clientes.filter(c => c.tipo_cliente === "PESSOA FÍSICA").length,
    revendedor: clientes.filter(c => c.tipo_cliente === "REVENDEDOR").length,
  };

  const comissaoMes = vendasMes * ((vendedor?.comissao_percentual || 0) / 100);
  const metaMensal = vendedor?.meta_mensal_valor || 0;
  const progressoMeta = metaMensal > 0 ? Math.min((vendasMes / metaMensal) * 100, 100) : 0;

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      RASCUNHO: { label: "Rascunho", variant: "secondary" },
      PENDENTE: { label: "Pendente", variant: "outline" },
      ENVIADO: { label: "Enviado", variant: "default" },
      FATURADO: { label: "Faturado", variant: "default" },
      PAGO: { label: "Pago", variant: "default" },
      CANCELADO: { label: "Cancelado", variant: "destructive" },
    };
    const mapped = statusMap[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={mapped.variant}>{mapped.label}</Badge>;
  };

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
          <h2 className="text-xl font-semibold mb-2">Painel do {isRepresentante ? 'Representante' : 'Vendedor'}</h2>
          <p className="text-muted-foreground">
            Você ainda não está cadastrado como {isRepresentante ? 'representante' : 'vendedor'} no sistema.
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

      {/* Info banner for representante */}
      {isRepresentante && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardContent className="py-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              👋 Você está logado como <strong>Representante</strong>. 
              Suas funções são focadas em vendas diretas aos clientes da sua carteira.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPIs - Row 1: Para REPRESENTANTE, apenas Total de Clientes e Vendas do Mês */}
      {isRepresentante ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientes.length}</div>
              <p className="text-xs text-muted-foreground">
                Na sua carteira
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {vendasMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Total faturado este mês
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
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
      )}

      {/* Comissão e Meta */}
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

      {/* REPRESENTANTE: Ações Rápidas e Últimos Pedidos */}
      {isRepresentante && (
        <>
          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setCadastrarClienteOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Novo Cliente
                </Button>
                <Button variant="outline" onClick={() => navigate("/vendedor/pedidos")}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Criar Pedido
                </Button>
                <Button variant="outline" onClick={() => navigate("/vendedor/pedidos")}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver Minhas Vendas
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Últimos Pedidos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Últimos Pedidos</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/vendedor/pedidos")}>
                Ver todos
              </Button>
            </CardHeader>
            <CardContent>
              {ultimosPedidos.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="mx-auto h-10 w-10 mb-2 opacity-50" />
                  <p>Nenhum pedido recente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ultimosPedidos.map((pedido: any) => (
                    <div 
                      key={pedido.id} 
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{pedido.cliente_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(pedido.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">
                          R$ {Number(pedido.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        {getStatusBadge(pedido.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Cards de Segmentação por Tipo de Cliente - Apenas para VENDEDOR */}
      {!isRepresentante && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Segmentação da Carteira</h3>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-purple-700 dark:text-purple-300">ADVECS</CardTitle>
                <Church className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{clientesPorTipo.advecs}</div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-blue-700 dark:text-blue-300">IGREJA CNPJ</CardTitle>
                <Building2 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{clientesPorTipo.igrejaCnpj}</div>
              </CardContent>
            </Card>

            <Card className="border-cyan-200 dark:border-cyan-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-cyan-700 dark:text-cyan-300">IGREJA CPF</CardTitle>
                <User className="h-4 w-4 text-cyan-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{clientesPorTipo.igrejaCpf}</div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-orange-700 dark:text-orange-300">LOJISTA</CardTitle>
                <Store className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{clientesPorTipo.lojista}</div>
              </CardContent>
            </Card>

            <Card className="border-teal-200 dark:border-teal-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-teal-700 dark:text-teal-300">REPRESENTANTE</CardTitle>
                <Handshake className="h-4 w-4 text-teal-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-teal-700 dark:text-teal-300">{clientesPorTipo.representante}</div>
              </CardContent>
            </Card>

            <Card className="border-pink-200 dark:border-pink-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-pink-700 dark:text-pink-300">PESSOA FÍSICA</CardTitle>
                <User className="h-4 w-4 text-pink-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-pink-700 dark:text-pink-300">{clientesPorTipo.pessoaFisica}</div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-amber-700 dark:text-amber-300">REVENDEDOR</CardTitle>
                <ShoppingBag className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{clientesPorTipo.revendedor}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Card de Clientes para Ativar - Only for vendedor */}
      {isVendedor && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ClientesParaAtivarCard vendedorId={vendedor.id} />
        </div>
      )}

      {/* Aulas Restantes Card - Only for vendedor */}
      {!isRepresentante && <AulasRestantesCard vendedorId={vendedor.id} />}

      {/* Card de Aniversariantes - Only for vendedor */}
      {!isRepresentante && (
        <AniversariantesCard 
          igrejas={clientes.map(c => ({
            id: c.id,
            nome: c.nome_igreja,
            data_aniversario_pastor: c.data_aniversario_pastor,
            data_aniversario_superintendente: c.data_aniversario_superintendente,
            cupom_aniversario_usado: c.cupom_aniversario_usado,
            tipo_cliente: c.tipo_cliente,
            responsavel: c.nome_responsavel || c.nome_superintendente,
          }))}
        />
      )}

      {/* Lead Scoring KPIs - Ocultado conforme solicitação */}
      {/* {isVendedor && <LeadScoringKPIs vendedorId={vendedor.id} />} */}

      {/* Cadastrar Cliente Dialog */}
      <CadastrarClienteDialog
        open={cadastrarClienteOpen}
        onOpenChange={setCadastrarClienteOpen}
        vendedorId={vendedor?.id || ""}
        onSuccess={refetch}
        clienteParaEditar={null}
        isRepresentante={isRepresentante}
      />
    </div>
  );
}
