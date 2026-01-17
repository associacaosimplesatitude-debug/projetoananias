import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, DollarSign, Clock, AlertTriangle, CheckCircle2, 
  Filter, Users, TrendingUp, Search, CreditCard, FileText,
  ExternalLink, ShoppingCart, Receipt
} from "lucide-react";
import { format, parseISO, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { toast } from "sonner";

interface Parcela {
  id: string;
  proposta_id: string | null;
  vendedor_id: string;
  cliente_id: string;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  valor_comissao: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  origem: string;
  metodo_pagamento: string | null;
  bling_order_number: string | null;
  bling_order_id: number | null;
}

interface Vendedor {
  id: string;
  nome: string;
  comissao_percentual: number;
}

interface Cliente {
  id: string;
  nome_igreja: string;
}

interface VendaFaturada {
  id: string;
  cliente_id: string | null;
  cliente_nome: string;
  vendedor_id: string | null;
  vendedor_nome: string | null;
  valor_total: number;
  valor_produtos: number;
  valor_frete: number | null;
  status: string;
  created_at: string;
  confirmado_em: string | null;
  bling_order_id: number | null;
  bling_order_number: string | null;
  link_danfe: string | null;
  prazo_faturamento_selecionado: string | null;
  tipo: 'faturado';
}

interface VendaOnline {
  id: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  vendedor_id: string | null;
  valor_total: number;
  valor_frete: number | null;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  order_number: string | null;
  tipo: 'online';
}

type Venda = VendaFaturada | VendaOnline;

export default function GestaoComissoes() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("vendas");
  const [mesSelecionado, setMesSelecionado] = useState<string>("todos");
  const [statusSelecionado, setStatusSelecionado] = useState<string>("todos");
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>("todos");
  const [origemSelecionada, setOrigemSelecionada] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch all parcelas
  const { data: parcelas = [], isLoading: parcelasLoading } = useQuery({
    queryKey: ["admin-todas-parcelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas_parcelas")
        .select("*")
        .order("data_vencimento", { ascending: true });
      
      if (error) throw error;
      return data as Parcela[];
    },
  });

  // Fetch propostas faturadas (vendas)
  const { data: propostasFaturadas = [], isLoading: propostasLoading } = useQuery({
    queryKey: ["admin-propostas-faturadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas")
        .select("*")
        .in("status", ["FATURADO", "PAGO"])
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map(p => ({ ...p, tipo: 'faturado' as const })) as VendaFaturada[];
    },
  });

  // Fetch pagamentos online (Mercado Pago)
  const { data: pagamentosOnline = [], isLoading: pagamentosLoading } = useQuery({
    queryKey: ["admin-pagamentos-online"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos_mercadopago")
        .select("*")
        .eq("payment_status", "approved")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map(p => ({ 
        ...p, 
        tipo: 'online' as const,
        order_number: p.mercadopago_payment_id?.toString() || null,
      })) as VendaOnline[];
    },
  });

  // Fetch all vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ["admin-vendedores-comissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, comissao_percentual")
        .ilike("status", "ativo")
        .order("nome");
      
      if (error) throw error;
      return data as Vendedor[];
    },
  });

  // Fetch clientes
  const clienteIdsParcelas = [...new Set(parcelas.map(p => p.cliente_id).filter(Boolean))];
  const clienteIdsPropostas = [...new Set(propostasFaturadas.map(p => p.cliente_id).filter(Boolean))];
  const clienteIdsPagamentos = [...new Set(pagamentosOnline.map(p => p.cliente_id).filter(Boolean))];
  const allClienteIds = [...new Set([...clienteIdsParcelas, ...clienteIdsPropostas, ...clienteIdsPagamentos])];
  
  const { data: clientes = [] } = useQuery({
    queryKey: ["admin-parcelas-clientes", allClienteIds],
    queryFn: async () => {
      if (allClienteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .in("id", allClienteIds);
      
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: allClienteIds.length > 0,
  });

  const clienteMap = useMemo(() => new Map(clientes.map(c => [c.id, c.nome_igreja])), [clientes]);
  const vendedorMap = useMemo(() => new Map(vendedores.map(v => [v.id, v])), [vendedores]);

  // Generate month options
  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    const hoje = new Date();
    
    for (let i = -6; i <= 6; i++) {
      const mes = addMonths(hoje, i);
      meses.add(format(mes, "yyyy-MM"));
    }
    
    parcelas.forEach(p => {
      const mes = format(parseISO(p.data_vencimento), "yyyy-MM");
      meses.add(mes);
    });

    propostasFaturadas.forEach(p => {
      const mes = format(parseISO(p.created_at), "yyyy-MM");
      meses.add(mes);
    });
    
    return Array.from(meses).sort();
  }, [parcelas, propostasFaturadas]);

  // Mutation for updating payment status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, dataPagamento }: { id: string; status: string; dataPagamento?: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (dataPagamento) {
        updateData.data_pagamento = dataPagamento;
      }
      
      const { error } = await supabase
        .from("vendedor_propostas_parcelas")
        .update(updateData)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-todas-parcelas"] });
      toast.success("Status da parcela atualizado!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status da parcela");
    },
  });

  const handleMarcarComoPaga = (parcelaId: string) => {
    updateStatusMutation.mutate({
      id: parcelaId,
      status: "paga",
      dataPagamento: format(new Date(), "yyyy-MM-dd"),
    });
  };

  // ============ VENDAS FILTERING ============
  const vendasFiltradas = useMemo(() => {
    let resultado: Venda[] = [];

    // Combinar propostas faturadas e pagamentos online
    if (origemSelecionada === "todos" || origemSelecionada === "faturado") {
      resultado = [...resultado, ...propostasFaturadas];
    }
    if (origemSelecionada === "todos" || origemSelecionada === "online") {
      resultado = [...resultado, ...pagamentosOnline];
    }

    // Filter by month
    if (mesSelecionado !== "todos") {
      resultado = resultado.filter(v => {
        const mes = format(parseISO(v.created_at), "yyyy-MM");
        return mes === mesSelecionado;
      });
    }

    // Filter by vendedor
    if (vendedorSelecionado !== "todos") {
      resultado = resultado.filter(v => v.vendedor_id === vendedorSelecionado);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      resultado = resultado.filter(v => {
        const cliente = v.tipo === 'faturado' 
          ? v.cliente_nome?.toLowerCase() || ""
          : v.cliente_nome?.toLowerCase() || "";
        const clienteNome = clienteMap.get(v.cliente_id || "")?.toLowerCase() || "";
        const vendedor = vendedorMap.get(v.vendedor_id || "")?.nome?.toLowerCase() || "";
        return cliente.includes(term) || clienteNome.includes(term) || vendedor.includes(term);
      });
    }

    // Sort by date desc
    return resultado.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [propostasFaturadas, pagamentosOnline, mesSelecionado, vendedorSelecionado, origemSelecionada, searchTerm, clienteMap, vendedorMap]);

  // Calculate vendas totals
  const totaisVendas = useMemo(() => {
    const faturadas = vendasFiltradas.filter(v => v.tipo === 'faturado') as VendaFaturada[];
    const online = vendasFiltradas.filter(v => v.tipo === 'online') as VendaOnline[];

    const totalFaturado = faturadas.reduce((sum, v) => sum + Number(v.valor_total || 0), 0);
    const totalOnline = online.reduce((sum, v) => sum + Number(v.valor_total || 0), 0);
    const totalGeral = totalFaturado + totalOnline;

    // Calcular comissões
    let comissaoTotal = 0;
    vendasFiltradas.forEach(v => {
      const vendedor = vendedorMap.get(v.vendedor_id || "");
      const comissaoPercentual = vendedor?.comissao_percentual || 1.5;
      const valorBase = Number(v.valor_total || 0) - Number(v.valor_frete || 0);
      comissaoTotal += valorBase * (comissaoPercentual / 100);
    });

    return {
      totalFaturado,
      totalOnline,
      totalGeral,
      comissaoTotal,
      quantidadeFaturado: faturadas.length,
      quantidadeOnline: online.length,
      quantidadeTotal: vendasFiltradas.length,
    };
  }, [vendasFiltradas, vendedorMap]);

  // Filter parcelas
  const parcelasFiltradas = useMemo(() => {
    let resultado = [...parcelas];

    // Filter by month
    if (mesSelecionado !== "todos") {
      resultado = resultado.filter(p => {
        const mes = format(parseISO(p.data_vencimento), "yyyy-MM");
        return mes === mesSelecionado;
      });
    }

    // Filter by status
    if (statusSelecionado !== "todos") {
      resultado = resultado.filter(p => p.status === statusSelecionado);
    }

    // Filter by vendedor
    if (vendedorSelecionado !== "todos") {
      resultado = resultado.filter(p => p.vendedor_id === vendedorSelecionado);
    }

    // Filter by origem
    if (origemSelecionada !== "todos") {
      resultado = resultado.filter(p => {
        if (origemSelecionada === "faturado") return p.origem === "faturado";
        if (origemSelecionada === "online") return p.origem === "mercadopago";
        return true;
      });
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      resultado = resultado.filter(p => {
        const cliente = clienteMap.get(p.cliente_id)?.toLowerCase() || "";
        const vendedor = vendedorMap.get(p.vendedor_id)?.nome?.toLowerCase() || "";
        return cliente.includes(term) || vendedor.includes(term);
      });
    }

    return resultado;
  }, [parcelas, mesSelecionado, statusSelecionado, vendedorSelecionado, origemSelecionada, searchTerm, clienteMap, vendedorMap]);

  // Calculate parcelas totals
  const totaisParcelas = useMemo(() => {
    return {
      total: parcelasFiltradas.reduce((sum, p) => sum + Number(p.valor || 0), 0),
      comissao: parcelasFiltradas.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
      quantidade: parcelasFiltradas.length,
      pagas: parcelasFiltradas.filter(p => p.status === "paga").length,
      aguardando: parcelasFiltradas.filter(p => p.status === "aguardando").length,
      atrasadas: parcelasFiltradas.filter(p => p.status === "atrasada").length,
      comissaoPaga: parcelasFiltradas.filter(p => p.status === "paga").reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
      comissaoPendente: parcelasFiltradas.filter(p => p.status !== "paga").reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
    };
  }, [parcelasFiltradas]);

  // Summary by vendedor for vendas
  const resumoPorVendedorVendas = useMemo(() => {
    const resumo = new Map<string, { totalVendas: number; comissao: number; quantidade: number }>();
    
    vendasFiltradas.forEach(v => {
      const vendedorId = v.vendedor_id || "";
      if (!vendedorId) return;
      
      const current = resumo.get(vendedorId) || { totalVendas: 0, comissao: 0, quantidade: 0 };
      const vendedor = vendedorMap.get(vendedorId);
      const comissaoPercentual = vendedor?.comissao_percentual || 1.5;
      const valorBase = Number(v.valor_total || 0) - Number(v.valor_frete || 0);
      
      current.totalVendas += valorBase;
      current.comissao += valorBase * (comissaoPercentual / 100);
      current.quantidade++;
      resumo.set(vendedorId, current);
    });

    return Array.from(resumo.entries())
      .map(([vendedorId, data]) => ({
        vendedorId,
        vendedorNome: vendedorMap.get(vendedorId)?.nome || "Desconhecido",
        ...data,
      }))
      .sort((a, b) => b.totalVendas - a.totalVendas);
  }, [vendasFiltradas, vendedorMap]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paga":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paga
          </Badge>
        );
      case "atrasada":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Atrasada
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando
          </Badge>
        );
    }
  };

  const getOrigemBadge = (origem: string) => {
    if (origem === "mercadopago" || origem === "online") {
      return <Badge variant="outline" className="text-blue-600 border-blue-300">Pag. Online</Badge>;
    }
    return <Badge variant="outline">Faturado</Badge>;
  };

  const getVendaStatusBadge = (venda: Venda) => {
    if (venda.tipo === 'online') {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Pago
        </Badge>
      );
    }
    
    if (venda.status === "PAGO") {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Pago
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
        <FileText className="h-3 w-3 mr-1" />
        Faturado
      </Badge>
    );
  };

  const getMetodoPagamentoBadge = (metodo: string | null) => {
    if (!metodo) return null;
    
    const metodosMap: Record<string, { label: string; icon: JSX.Element }> = {
      pix: { label: "PIX", icon: <DollarSign className="h-3 w-3" /> },
      cartao: { label: "Cartão", icon: <CreditCard className="h-3 w-3" /> },
      cartao_debito: { label: "Débito", icon: <CreditCard className="h-3 w-3" /> },
      credit_card: { label: "Cartão", icon: <CreditCard className="h-3 w-3" /> },
      boleto_avista: { label: "À Vista", icon: <FileText className="h-3 w-3" /> },
      boleto_30: { label: "30 dias", icon: <FileText className="h-3 w-3" /> },
      boleto_60: { label: "60 dias", icon: <FileText className="h-3 w-3" /> },
      boleto_90: { label: "90 dias", icon: <FileText className="h-3 w-3" /> },
    };

    const config = metodosMap[metodo] || { label: metodo, icon: <DollarSign className="h-3 w-3" /> };
    
    return (
      <Badge variant="outline" className="text-xs">
        {config.icon}
        <span className="ml-1">{config.label}</span>
      </Badge>
    );
  };

  const getPrazoLabel = (prazo: string | null) => {
    const prazoMap: Record<string, string> = {
      '30': 'Boleto 30 dias',
      '60': 'Boleto 30/60 dias',
      '60_direto': 'Boleto 60 dias',
      '60_90': 'Boleto 60/90 dias',
      '90': 'Boleto 30/60/90 dias',
    };
    return prazoMap[prazo || ''] || prazo || '-';
  };

  const calcularComissao = (venda: Venda) => {
    const vendedor = vendedorMap.get(venda.vendedor_id || "");
    const comissaoPercentual = vendedor?.comissao_percentual || 1.5;
    const valorBase = Number(venda.valor_total || 0) - Number(venda.valor_frete || 0);
    return valorBase * (comissaoPercentual / 100);
  };

  const isLoading = parcelasLoading || propostasLoading || pagamentosLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Gestão de Comissões</h2>
        <p className="text-muted-foreground">
          Acompanhe vendas e comissões de todos os vendedores
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="vendas" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Vendas
          </TabsTrigger>
          <TabsTrigger value="parcelas" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Parcelas
          </TabsTrigger>
        </TabsList>

        {/* ============ ABA VENDAS ============ */}
        <TabsContent value="vendas" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-700">Faturado</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  R$ {totaisVendas.totalFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-blue-600">{totaisVendas.quantidadeFaturado} vendas</p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-700">Pagamento Online</CardTitle>
                <CreditCard className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  R$ {totaisVendas.totalOnline.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-green-600">{totaisVendas.quantidadeOnline} vendas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {totaisVendas.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">{totaisVendas.quantidadeTotal} vendas no período</p>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-700">Comissões</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-700">
                  R$ {totaisVendas.comissaoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-purple-600">a pagar aos vendedores</p>
              </CardContent>
            </Card>
          </div>

          {/* Resumo por Vendedor */}
          {resumoPorVendedorVendas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Resumo por Vendedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {resumoPorVendedorVendas.slice(0, 6).map((item) => (
                    <div
                      key={item.vendedorId}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div>
                        <p className="font-medium">{item.vendedorNome}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantidade} vendas
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          R$ {item.totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-sm text-purple-600">
                          R$ {item.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} com.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="w-48">
                  <label className="text-sm font-medium mb-1 block">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cliente ou vendedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="w-48">
                  <label className="text-sm font-medium mb-1 block">Mês</label>
                  <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os meses</SelectItem>
                      {mesesDisponiveis.map(mes => (
                        <SelectItem key={mes} value={mes}>
                          {format(parseISO(`${mes}-01`), "MMMM/yyyy", { locale: ptBR })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-48">
                  <label className="text-sm font-medium mb-1 block">Vendedor</label>
                  <Select value={vendedorSelecionado} onValueChange={setVendedorSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {vendedores.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-40">
                  <label className="text-sm font-medium mb-1 block">Origem</label>
                  <Select value={origemSelecionada} onValueChange={setOrigemSelecionada}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="faturado">Faturado</SelectItem>
                      <SelectItem value="online">Pag. Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendas Table */}
          <Card>
            <CardHeader>
              <CardTitle>Vendas ({vendasFiltradas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {vendasFiltradas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma venda encontrada para os filtros selecionados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>NF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendasFiltradas.slice(0, 100).map((venda) => (
                        <TableRow key={venda.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(parseISO(venda.created_at), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {vendedorMap.get(venda.vendedor_id || "")?.nome || "-"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {venda.tipo === 'faturado' 
                              ? venda.cliente_nome 
                              : venda.cliente_nome || clienteMap.get(venda.cliente_id || "") || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {Number(venda.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-purple-600 font-medium">
                            R$ {calcularComissao(venda).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {getOrigemBadge(venda.tipo === 'faturado' ? 'faturado' : 'online')}
                          </TableCell>
                          <TableCell>
                            {venda.tipo === 'faturado' 
                              ? getPrazoLabel(venda.prazo_faturamento_selecionado)
                              : getMetodoPagamentoBadge((venda as VendaOnline).payment_method)}
                          </TableCell>
                          <TableCell>
                            {getVendaStatusBadge(venda)}
                          </TableCell>
                          <TableCell>
                            {venda.tipo === 'faturado' && venda.bling_order_number ? (
                              <div className="flex items-center gap-1">
                                <span className="text-sm">{venda.bling_order_number}</span>
                                {venda.link_danfe && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => window.open(venda.link_danfe!, "_blank")}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA PARCELAS ============ */}
        <TabsContent value="parcelas" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-700">Comissão Paga</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  R$ {totaisParcelas.comissaoPaga.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-green-600">{totaisParcelas.pagas} parcelas pagas</p>
              </CardContent>
            </Card>

            <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-yellow-700">Comissão Pendente</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-700">
                  R$ {totaisParcelas.comissaoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-yellow-600">{totaisParcelas.aguardando + totaisParcelas.atrasadas} parcelas pendentes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Parcelas</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totaisParcelas.quantidade}</div>
                <p className="text-xs text-muted-foreground">no período selecionado</p>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-700">Atrasadas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">{totaisParcelas.atrasadas}</div>
                <p className="text-xs text-red-600">requerem atenção</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="w-48">
                  <label className="text-sm font-medium mb-1 block">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cliente ou vendedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="w-48">
                  <label className="text-sm font-medium mb-1 block">Mês de Vencimento</label>
                  <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os meses</SelectItem>
                      {mesesDisponiveis.map(mes => (
                        <SelectItem key={mes} value={mes}>
                          {format(parseISO(`${mes}-01`), "MMMM/yyyy", { locale: ptBR })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-40">
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={statusSelecionado} onValueChange={setStatusSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="aguardando">Aguardando</SelectItem>
                      <SelectItem value="paga">Pagas</SelectItem>
                      <SelectItem value="atrasada">Atrasadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-48">
                  <label className="text-sm font-medium mb-1 block">Vendedor</label>
                  <Select value={vendedorSelecionado} onValueChange={setVendedorSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {vendedores.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-40">
                  <label className="text-sm font-medium mb-1 block">Origem</label>
                  <Select value={origemSelecionada} onValueChange={setOrigemSelecionada}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="faturado">Faturado</SelectItem>
                      <SelectItem value="online">Pag. Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parcelas Table */}
          <Card>
            <CardHeader>
              <CardTitle>Parcelas ({parcelasFiltradas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {parcelasFiltradas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma parcela encontrada para os filtros selecionados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Parcela</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parcelasFiltradas.slice(0, 100).map((parcela) => (
                        <TableRow key={parcela.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(parseISO(parcela.data_vencimento), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {vendedorMap.get(parcela.vendedor_id)?.nome || "-"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {clienteMap.get(parcela.cliente_id) || "-"}
                          </TableCell>
                          <TableCell>
                            {parcela.numero_parcela}/{parcela.total_parcelas}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {Number(parcela.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-purple-600 font-medium">
                            R$ {Number(parcela.valor_comissao || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {getMetodoPagamentoBadge(parcela.metodo_pagamento)}
                          </TableCell>
                          <TableCell>
                            {getOrigemBadge(parcela.origem)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(parcela.status)}
                          </TableCell>
                          <TableCell>
                            {parcela.status !== "paga" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarcarComoPaga(parcela.id)}
                                disabled={updateStatusMutation.isPending}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Pagar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
