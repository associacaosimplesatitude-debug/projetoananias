import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  Filter, Search, Wallet, Calendar, Clock, CheckCircle2, 
  AlertTriangle, FileText, TrendingUp, List, Users
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { 
  ComissaoKPICards, 
  ComissaoDashboardBlocks, 
  ComissaoTable,
  ComissaoAgrupadaVendedor,
  LotePagamentoDialog,
  LotePagamentoList,
  LoteDetalheDialog
} from "@/components/admin/comissoes";

interface Parcela {
  id: string;
  proposta_id: string | null;
  vendedor_id: string | null;
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
  comissao_status: string;
  data_liberacao: string | null;
  comissao_paga_em: string | null;
  lote_pagamento_id: string | null;
  proposta?: {
    id: string;
    vendedor_email: string | null;
    vendedor_nome: string | null;
    bling_order_number: string | null;
    link_danfe: string | null;
  } | null;
}

interface Vendedor {
  id: string;
  nome: string;
  email: string | null;
  comissao_percentual: number;
  foto_url: string | null;
}

interface Cliente {
  id: string;
  nome_igreja: string;
}

interface LotePagamento {
  id: string;
  referencia: string;
  mes_referencia: string;
  tipo: string;
  valor_total: number;
  quantidade_itens: number;
  status: string;
  created_at: string;
  pago_em: string | null;
}

export default function GestaoComissoes() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("resumo");
  const [viewMode, setViewMode] = useState<string>("agrupado");
  const [statusSelecionado, setStatusSelecionado] = useState<string>("liberada");
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>("todos");
  const [tipoSelecionado, setTipoSelecionado] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [showLoteDialog, setShowLoteDialog] = useState(false);
  const [showLoteDetalheDialog, setShowLoteDetalheDialog] = useState(false);
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);

  // Fetch all parcelas with comissao_status
  const { data: parcelas = [], isLoading: parcelasLoading } = useQuery({
    queryKey: ["admin-comissoes-parcelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas_parcelas")
        .select("*, proposta:vendedor_propostas(id, vendedor_email, vendedor_nome, bling_order_number, link_danfe)")
        .order("data_vencimento", { ascending: true });
      
      if (error) throw error;
      return data as Parcela[];
    },
  });

  // Fetch lotes de pagamento
  const { data: lotes = [], isLoading: lotesLoading } = useQuery({
    queryKey: ["admin-lotes-pagamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissao_lotes_pagamento")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as LotePagamento[];
    },
  });

  // Fetch vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ["admin-vendedores-comissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, email, comissao_percentual, foto_url")
        .order("nome");
      
      if (error) throw error;
      return data as Vendedor[];
    },
  });

  // Fetch clientes
  const clienteIds = [...new Set(parcelas.map(p => p.cliente_id).filter(Boolean))];
  const { data: clientes = [] } = useQuery({
    queryKey: ["admin-comissoes-clientes", clienteIds],
    queryFn: async () => {
      if (clienteIds.length === 0) return [];
      const { data, error } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .in("id", clienteIds);
      
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: clienteIds.length > 0,
  });

  // Maps
  const clienteMap = useMemo(() => new Map(clientes.map(c => [c.id, c.nome_igreja])), [clientes]);
  const vendedorById = useMemo(() => new Map(vendedores.map(v => [v.id, v])), [vendedores]);
  const normalizeEmail = (email: string | null | undefined) => email?.trim().toLowerCase() || "";
  const vendedorByEmail = useMemo(() => {
    const map = new Map<string, Vendedor>();
    vendedores.forEach(v => {
      if (v.email) map.set(normalizeEmail(v.email), v);
    });
    return map;
  }, [vendedores]);

  // Resolve vendedor info
  const resolveVendedorInfo = (parcela: Parcela) => {
    let nome = "Desconhecido";
    let foto: string | null = null;
    
    if (parcela.vendedor_id) {
      const vendedor = vendedorById.get(parcela.vendedor_id);
      if (vendedor) {
        nome = vendedor.nome;
        foto = vendedor.foto_url;
      }
    } else if (parcela.proposta?.vendedor_nome) {
      nome = parcela.proposta.vendedor_nome;
      if (parcela.proposta?.vendedor_email) {
        const vendedor = vendedorByEmail.get(normalizeEmail(parcela.proposta.vendedor_email));
        if (vendedor) foto = vendedor.foto_url;
      }
    } else if (parcela.proposta?.vendedor_email) {
      const vendedor = vendedorByEmail.get(normalizeEmail(parcela.proposta.vendedor_email));
      if (vendedor) {
        nome = vendedor.nome;
        foto = vendedor.foto_url;
      }
    }
    
    return { nome, foto };
  };

  // Calculate KPIs
  const kpis = useMemo(() => {
    const hoje = new Date();
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);

    const aPagar = parcelas.filter(p => p.comissao_status === 'liberada');
    const agendadas = parcelas.filter(p => p.comissao_status === 'agendada');
    const pendentes = parcelas.filter(p => p.comissao_status === 'pendente');
    const pagas = parcelas.filter(p => {
      if (p.comissao_status !== 'paga') return false;
      if (!p.comissao_paga_em) return false;
      const dataPaga = parseISO(p.comissao_paga_em);
      return dataPaga >= inicioMes && dataPaga <= fimMes;
    });
    const atrasadas = parcelas.filter(p => p.comissao_status === 'atrasada');

    return {
      aPagar: {
        valor: aPagar.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        quantidade: aPagar.length
      },
      agendadas: {
        valor: agendadas.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        quantidade: agendadas.length
      },
      pendentes: {
        valor: pendentes.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        quantidade: pendentes.length
      },
      pagas: {
        valor: pagas.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        quantidade: pagas.length
      },
      atrasadas: {
        valor: atrasadas.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        quantidade: atrasadas.length
      }
    };
  }, [parcelas]);

  // Dashboard blocks data
  const dashboardBlocks = useMemo(() => {
    // Pagamento Dia 05 - vendas online do mês
    const agendadasOnline = parcelas.filter(p => 
      p.comissao_status === 'agendada' && (p.origem === 'mercadopago' || p.origem === 'online')
    );
    const liberadasOnline = parcelas.filter(p => 
      p.comissao_status === 'liberada' && (p.origem === 'mercadopago' || p.origem === 'online')
    );

    // Recebimentos 30/60/90
    const pendentesFaturado = parcelas.filter(p => 
      p.comissao_status === 'pendente' && p.origem === 'faturado'
    );
    const liberadosHoje = parcelas.filter(p => {
      if (p.comissao_status !== 'liberada' || p.origem !== 'faturado') return false;
      if (!p.data_liberacao) return false;
      return isToday(parseISO(p.data_liberacao));
    });
    const atrasadosFaturado = parcelas.filter(p => 
      p.comissao_status === 'atrasada' && p.origem === 'faturado'
    );

    return {
      pagamentoDia05: {
        agendado: agendadasOnline.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        liberado: liberadasOnline.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        quantidadeAgendada: agendadasOnline.length,
        quantidadeLiberada: liberadasOnline.length
      },
      recebimentos: {
        pendente: pendentesFaturado.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        liberadoHoje: liberadosHoje.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        atrasado: atrasadosFaturado.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
        quantidadePendente: pendentesFaturado.length,
        quantidadeLiberadoHoje: liberadosHoje.length,
        quantidadeAtrasado: atrasadosFaturado.length
      }
    };
  }, [parcelas]);

  // Top 5 vendedores (liberadas)
  const top5Vendedores = useMemo(() => {
    const liberadas = parcelas.filter(p => p.comissao_status === 'liberada' && !p.lote_pagamento_id);
    const agrupado = liberadas.reduce((acc, p) => {
      const info = resolveVendedorInfo(p);
      const key = info.nome;
      if (!acc[key]) {
        acc[key] = { vendedor_nome: info.nome, vendedor_foto: info.foto, total: 0 };
      }
      acc[key].total += Number(p.valor_comissao || 0);
      return acc;
    }, {} as Record<string, { vendedor_nome: string; vendedor_foto: string | null; total: number }>);
    
    return Object.values(agrupado).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [parcelas, vendedorById, vendedorByEmail]);

  // Comissões para lote (liberadas sem lote)
  const comissoesParaLote = useMemo(() => {
    return parcelas
      .filter(p => p.comissao_status === 'liberada' && !p.lote_pagamento_id)
      .map(p => {
        const info = resolveVendedorInfo(p);
        return {
          id: p.id,
          vendedor_id: p.vendedor_id,
          vendedor_nome: info.nome,
          vendedor_foto: info.foto,
          cliente_nome: clienteMap.get(p.cliente_id) || "-",
          valor_comissao: Number(p.valor_comissao || 0),
          data_vencimento: p.data_vencimento,
          tipo: (p.origem === 'mercadopago' || p.origem === 'online') ? 'Online' : 'Faturado'
        };
      });
  }, [parcelas, clienteMap, vendedorById, vendedorByEmail]);

  // Filter comissoes for table
  const comissoesFiltradas = useMemo(() => {
    let resultado = [...parcelas];

    // Filter by status (only for A Pagar tab)
    if (statusSelecionado !== "todos") {
      resultado = resultado.filter(p => p.comissao_status === statusSelecionado);
    }

    // Filter by vendedor
    if (vendedorSelecionado !== "todos") {
      resultado = resultado.filter(p => p.vendedor_id === vendedorSelecionado);
    }

    // Filter by tipo
    if (tipoSelecionado !== "todos") {
      resultado = resultado.filter(p => {
        if (tipoSelecionado === "online") return p.origem === "mercadopago" || p.origem === "online";
        if (tipoSelecionado === "faturado") return p.origem === "faturado";
        return true;
      });
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      resultado = resultado.filter(p => {
        const cliente = clienteMap.get(p.cliente_id)?.toLowerCase() || "";
        const info = resolveVendedorInfo(p);
        return cliente.includes(term) || info.nome.toLowerCase().includes(term);
      });
    }

    return resultado.map(p => {
      const info = resolveVendedorInfo(p);
      return {
        id: p.id,
        vendedor_id: p.vendedor_id,
        vendedor_nome: info.nome,
        vendedor_foto: info.foto,
        cliente_id: p.cliente_id,
        cliente_nome: clienteMap.get(p.cliente_id) || "-",
        tipo: ((p.origem === 'mercadopago' || p.origem === 'online') ? 'online' : 'faturado') as 'online' | 'faturado',
        numero_parcela: p.numero_parcela,
        total_parcelas: p.total_parcelas,
        data_vencimento: p.data_vencimento,
        data_liberacao: p.data_liberacao,
        valor: Number(p.valor || 0),
        valor_comissao: Number(p.valor_comissao || 0),
        comissao_status: p.comissao_status || 'pendente',
        metodo_pagamento: p.metodo_pagamento,
        bling_order_number: p.bling_order_number || p.proposta?.bling_order_number || null,
        link_danfe: p.proposta?.link_danfe || null
      };
    });
  }, [parcelas, statusSelecionado, vendedorSelecionado, tipoSelecionado, searchTerm, clienteMap, vendedorById, vendedorByEmail]);

  // Lote detail comissoes
  const loteDetalheComissoes = useMemo(() => {
    if (!selectedLoteId) return [];
    return parcelas
      .filter(p => p.lote_pagamento_id === selectedLoteId)
      .map(p => {
        const info = resolveVendedorInfo(p);
        return {
          id: p.id,
          vendedor_nome: info.nome,
          vendedor_foto: info.foto,
          cliente_nome: clienteMap.get(p.cliente_id) || "-",
          valor_comissao: Number(p.valor_comissao || 0),
          data_vencimento: p.data_vencimento,
          tipo: (p.origem === 'mercadopago' || p.origem === 'online') ? 'Online' : 'Faturado'
        };
      });
  }, [parcelas, selectedLoteId, clienteMap, vendedorById, vendedorByEmail]);

  const selectedLote = useMemo(() => {
    return lotes.find(l => l.id === selectedLoteId) || null;
  }, [lotes, selectedLoteId]);

  // Mutation: marcar como paga
  const marcarPagaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vendedor_propostas_parcelas")
        .update({ 
          comissao_status: 'paga',
          comissao_paga_em: new Date().toISOString()
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
      toast.success("Comissão marcada como paga!");
    },
    onError: (error) => {
      console.error("Erro ao marcar como paga:", error);
      toast.error("Erro ao marcar comissão como paga");
    },
  });

  // Mutation: criar lote de pagamento
  const criarLoteMutation = useMutation({
    mutationFn: async (referencia: string) => {
      const ids = comissoesParaLote.map(c => c.id);
      const valorTotal = comissoesParaLote.reduce((sum, c) => sum + c.valor_comissao, 0);
      
      // Criar lote
      const { data: lote, error: loteError } = await supabase
        .from("comissao_lotes_pagamento")
        .insert({
          referencia,
          mes_referencia: format(startOfMonth(new Date()), "yyyy-MM-dd"),
          tipo: 'dia_05',
          valor_total: valorTotal,
          quantidade_itens: ids.length,
          status: 'pago',
          pago_em: new Date().toISOString()
        })
        .select()
        .single();

      if (loteError) throw loteError;

      // Atualizar parcelas com lote_id e status paga
      const { error: updateError } = await supabase
        .from("vendedor_propostas_parcelas")
        .update({ 
          lote_pagamento_id: lote.id,
          comissao_status: 'paga',
          comissao_paga_em: new Date().toISOString()
        })
        .in("id", ids);

      if (updateError) throw updateError;

      return lote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["admin-lotes-pagamento"] });
      setShowLoteDialog(false);
      toast.success("Lote de pagamento criado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar lote:", error);
      toast.error("Erro ao criar lote de pagamento");
    },
  });

  const handleViewDetail = (status: string) => {
    setStatusSelecionado(status);
    if (status === 'paga') {
      setActiveTab('pagas');
    } else if (status === 'agendada' || status === 'pendente') {
      setActiveTab('pendentes');
    } else {
      setActiveTab('a_pagar');
    }
  };

  const handleViewLoteDetail = (loteId: string) => {
    setSelectedLoteId(loteId);
    setShowLoteDetalheDialog(true);
  };

  const isLoading = parcelasLoading;

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
        <h2 className="text-2xl font-bold">Comissões</h2>
        <p className="text-muted-foreground">
          Gerencie obrigações de pagamento de comissões aos vendedores
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="resumo" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="a_pagar" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">A Pagar</span>
            {kpis.aPagar.quantidade > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {kpis.aPagar.quantidade}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Pendentes</span>
          </TabsTrigger>
          <TabsTrigger value="pagas" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Pagas</span>
          </TabsTrigger>
          <TabsTrigger value="lotes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Lotes</span>
          </TabsTrigger>
        </TabsList>

        {/* ============ ABA RESUMO ============ */}
        <TabsContent value="resumo" className="space-y-6">
          <ComissaoKPICards 
            kpis={kpis} 
            onViewDetail={handleViewDetail}
          />
          
          <ComissaoDashboardBlocks
            pagamentoDia05={dashboardBlocks.pagamentoDia05}
            recebimentos={dashboardBlocks.recebimentos}
            top5Vendedores={top5Vendedores}
            onGerarLote={() => setShowLoteDialog(true)}
            onVerTodos={() => { setActiveTab('a_pagar'); setViewMode('agrupado'); }}
            isGenerating={criarLoteMutation.isPending}
          />

          {/* Atrasadas (se houver) */}
          {kpis.atrasadas.quantidade > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Comissões Atrasadas ({kpis.atrasadas.quantidade})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ComissaoTable
                  comissoes={comissoesFiltradas.filter(c => c.comissao_status === 'atrasada').slice(0, 10)}
                  onMarcarPaga={(id) => marcarPagaMutation.mutate(id)}
                  isUpdating={marcarPagaMutation.isPending}
                  showActions={false}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ ABA A PAGAR ============ */}
        <TabsContent value="a_pagar" className="space-y-6">
          <Card className="border-green-200 bg-gradient-to-r from-green-50/50 to-emerald-50/50">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total a Pagar</p>
                  <p className="text-3xl font-bold text-green-700">
                    R$ {kpis.aPagar.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-green-600">{kpis.aPagar.quantidade} comissões liberadas</p>
                </div>
                <Button 
                  onClick={() => setShowLoteDialog(true)}
                  disabled={comissoesParaLote.length === 0}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar Lote de Pagamento
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filters + Toggle */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
                <ToggleGroup 
                  type="single" 
                  value={viewMode} 
                  onValueChange={(v) => v && setViewMode(v)}
                  className="border rounded-lg"
                >
                  <ToggleGroupItem value="agrupado" aria-label="Visão agrupada" className="gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Agrupado</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="lista" aria-label="Visão em lista" className="gap-2">
                    <List className="h-4 w-4" />
                    <span className="hidden sm:inline">Lista</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
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
                  <label className="text-sm font-medium mb-1 block">Tipo</label>
                  <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="faturado">Faturado</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comissões Liberadas ({comissoesFiltradas.filter(c => c.comissao_status === 'liberada').length})</CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === 'agrupado' ? (
                <ComissaoAgrupadaVendedor
                  comissoes={comissoesFiltradas.filter(c => c.comissao_status === 'liberada')}
                  onMarcarPaga={(id) => marcarPagaMutation.mutate(id)}
                  isUpdating={marcarPagaMutation.isPending}
                />
              ) : (
                <ComissaoTable
                  comissoes={comissoesFiltradas.filter(c => c.comissao_status === 'liberada')}
                  onMarcarPaga={(id) => marcarPagaMutation.mutate(id)}
                  isUpdating={marcarPagaMutation.isPending}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA PENDENTES ============ */}
        <TabsContent value="pendentes" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-700 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Agendadas (Dia 05)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-700">
                  R$ {kpis.agendadas.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-blue-600">{kpis.agendadas.quantidade} vendas online aguardando dia 05</p>
              </CardContent>
            </Card>

            <Card className="border-yellow-200">
              <CardHeader>
                <CardTitle className="text-yellow-700 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pendentes (30/60/90)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-700">
                  R$ {kpis.pendentes.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-yellow-600">{kpis.pendentes.quantidade} parcelas aguardando recebimento</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Todas as Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <ComissaoTable
                comissoes={[
                  ...comissoesFiltradas.filter(c => c.comissao_status === 'agendada'),
                  ...comissoesFiltradas.filter(c => c.comissao_status === 'pendente')
                ]}
                onMarcarPaga={(id) => marcarPagaMutation.mutate(id)}
                isUpdating={marcarPagaMutation.isPending}
                showActions={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA PAGAS ============ */}
        <TabsContent value="pagas" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pagas este mês</p>
                  <p className="text-3xl font-bold">
                    R$ {kpis.pagas.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-muted-foreground">{kpis.pagas.quantidade} comissões</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comissões Pagas</CardTitle>
            </CardHeader>
            <CardContent>
              <ComissaoTable
                comissoes={comissoesFiltradas.filter(c => c.comissao_status === 'paga')}
                onMarcarPaga={() => {}}
                showActions={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA LOTES ============ */}
        <TabsContent value="lotes" className="space-y-6">
          <LotePagamentoList
            lotes={lotes}
            isLoading={lotesLoading}
            onViewDetails={handleViewLoteDetail}
          />
        </TabsContent>
      </Tabs>

      {/* Dialog de Lote */}
      <LotePagamentoDialog
        open={showLoteDialog}
        onOpenChange={setShowLoteDialog}
        comissoes={comissoesParaLote}
        onConfirmar={(referencia) => criarLoteMutation.mutate(referencia)}
        isLoading={criarLoteMutation.isPending}
      />

      {/* Dialog de Detalhe de Lote */}
      <LoteDetalheDialog
        open={showLoteDetalheDialog}
        onOpenChange={setShowLoteDetalheDialog}
        lote={selectedLote}
        comissoes={loteDetalheComissoes}
      />
    </div>
  );
}
