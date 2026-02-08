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
  AlertTriangle, FileText, TrendingUp, List, Users, RefreshCw, Download,
  ShoppingCart, Crown
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
  LoteDetalheDialog,
  VincularComissaoDialog,
  ComissaoHierarquicaTable,
  ComissaoHierarquicaItem,
  ComissaoResumoVendedoresCards,
  ComissaoResumoGerentesCards,
  ComissaoResumoAdminCard,
} from "@/components/admin/comissoes";
import { useUserRole } from "@/hooks/useUserRole";

interface VendedorExtended {
  id: string;
  nome: string;
  email: string | null;
  comissao_percentual: number;
  foto_url: string | null;
  is_gerente?: boolean;
  gerente_id?: string | null;
}

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
  link_danfe: string | null;
  nota_fiscal_numero: string | null;
  shopify_pedido_id: string | null;
  proposta?: {
    id: string;
    vendedor_email: string | null;
    vendedor_nome: string | null;
    bling_order_number: string | null;
    link_danfe: string | null;
  } | null;
  shopify_pedido?: {
    id: string;
    order_number: string | null;
    customer_email: string | null;
    valor_total: number | null;
    order_date: string | null;
    nota_fiscal_url: string | null;
    nota_fiscal_numero: string | null;
    bling_order_id: number | null;
  } | null;
}

interface Vendedor {
  id: string;
  nome: string;
  email: string | null;
  comissao_percentual: number;
  foto_url: string | null;
  is_gerente?: boolean;
  gerente_id?: string | null;
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
  const { isAdmin, isFinanceiro } = useUserRole();
  const [activeTab, setActiveTab] = useState<string>("resumo");
  const [viewMode, setViewMode] = useState<string>("agrupado");
  const [statusSelecionado, setStatusSelecionado] = useState<string>("liberada");
  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>("todos");
  const [tipoSelecionado, setTipoSelecionado] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [showLoteDialog, setShowLoteDialog] = useState(false);
  const [showLoteDetalheDialog, setShowLoteDetalheDialog] = useState(false);
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);
  
  // Filtros para aba Gerentes
  const [gerenteSearchTerm, setGerenteSearchTerm] = useState("");
  const [gerenteFiltro, setGerenteFiltro] = useState<string>("todos");
  const [vendedorEquipeFiltro, setVendedorEquipeFiltro] = useState<string>("todos");
  const [statusHierarquicoFiltro, setStatusHierarquicoFiltro] = useState<string>("todos");
  
  // State for manual linking dialog
  const [showVincularDialog, setShowVincularDialog] = useState(false);
  const [selectedParcelaVincular, setSelectedParcelaVincular] = useState<{ id: string; clienteNome: string } | null>(null);

  // State for NF loading per row
  const [fetchingNfeIds, setFetchingNfeIds] = useState<Set<string>>(new Set());

  // Fetch all parcelas with comissao_status
  const { data: parcelas = [], isLoading: parcelasLoading } = useQuery({
    queryKey: ["admin-comissoes-parcelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas_parcelas")
        .select("*, proposta:vendedor_propostas(id, vendedor_email, vendedor_nome, bling_order_number, link_danfe), shopify_pedido:ebd_shopify_pedidos(id, order_number, customer_email, valor_total, order_date, nota_fiscal_url, nota_fiscal_numero, bling_order_id)")
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

  // Fetch vendedores (com is_gerente e gerente_id)
  const { data: vendedores = [] } = useQuery({
    queryKey: ["admin-vendedores-comissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, email, comissao_percentual, foto_url, is_gerente, gerente_id")
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

  // Fetch pedidos Shopify de vendedores sem bling_order_id
  const { data: pedidosShopifyPendentes = [] } = useQuery({
    queryKey: ["shopify-pedidos-pendentes-bling"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, order_number, vendedor_id")
        .not("vendedor_id", "is", null)
        .eq("status_pagamento", "paid")
        .is("bling_order_id", null);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch comissões hierárquicas (gerentes) - visível para admin e financeiro
  const { data: comissoesGerentes = [] } = useQuery({
    queryKey: ["comissoes-hierarquicas-gerentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_hierarquicas')
        .select('*')
        .eq('tipo_beneficiario', 'gerente')
        .order('data_vencimento', { ascending: false });
      if (error) throw error;
      return data as ComissaoHierarquicaItem[];
    },
    enabled: isAdmin || isFinanceiro,
  });

  // Fetch comissões do admin - visível apenas para admin
  const { data: comissoesAdmin = [] } = useQuery({
    queryKey: ["comissoes-hierarquicas-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_hierarquicas')
        .select('*')
        .eq('tipo_beneficiario', 'admin')
        .order('data_vencimento', { ascending: false });
      if (error) throw error;
      return data as ComissaoHierarquicaItem[];
    },
    enabled: isAdmin,
  });

  // Mutation para comissões hierárquicas
  const marcarHierarquicaPagaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comissoes_hierarquicas")
        .update({ status: 'paga', pago_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes-hierarquicas-gerentes"] });
      queryClient.invalidateQueries({ queryKey: ["comissoes-hierarquicas-admin"] });
      toast.success("Comissão marcada como paga!");
    },
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

  // Resumo por vendedor para cards
  const resumoPorVendedor = useMemo(() => {
    return vendedores.map(v => {
      const comissoesVendedor = parcelas.filter(p => p.vendedor_id === v.id);
      return {
        id: v.id,
        nome: v.nome,
        foto: v.foto_url,
        aPagar: comissoesVendedor
          .filter(c => c.comissao_status === 'liberada')
          .reduce((sum, c) => sum + Number(c.valor_comissao || 0), 0),
        pendentes: comissoesVendedor
          .filter(c => c.comissao_status === 'pendente' || c.comissao_status === 'agendada')
          .reduce((sum, c) => sum + Number(c.valor_comissao || 0), 0),
      };
    }).filter(v => v.aPagar > 0 || v.pendentes > 0);
  }, [parcelas, vendedores]);

  // Lista de gerentes
  const gerentes = useMemo(() => {
    return vendedores.filter(v => v.is_gerente === true);
  }, [vendedores]);

  // Resumo por gerente para cards
  const resumoPorGerente = useMemo(() => {
    return gerentes.map(g => {
      const comissoesGerente = comissoesGerentes.filter(
        c => c.beneficiario_id === g.id
      );
      const equipe = vendedores
        .filter(v => v.gerente_id === g.id)
        .map(v => v.nome);
      return {
        id: g.id,
        nome: g.nome,
        foto: g.foto_url,
        equipe,
        aPagar: comissoesGerente
          .filter(c => c.status === 'liberada')
          .reduce((sum, c) => sum + Number(c.valor_comissao || 0), 0),
        pendentes: comissoesGerente
          .filter(c => c.status === 'pendente')
          .reduce((sum, c) => sum + Number(c.valor_comissao || 0), 0),
      };
    });
  }, [gerentes, comissoesGerentes, vendedores]);

  // Resumo das comissões do admin (1.5% overhead) - visível apenas para admin
  const resumoAdmin = useMemo(() => {
    if (!isAdmin) return null;
    
    const liberadas = comissoesAdmin.filter(c => c.status === 'liberada');
    const pendentes = comissoesAdmin.filter(c => c.status === 'pendente');
    
    return {
      aPagar: liberadas.reduce((sum, c) => sum + Number(c.valor_comissao || 0), 0),
      pendentes: pendentes.reduce((sum, c) => sum + Number(c.valor_comissao || 0), 0),
      quantidadeAPagar: liberadas.length,
      quantidadePendentes: pendentes.length,
    };
  }, [comissoesAdmin, isAdmin]);

  // Filtrar comissões hierárquicas (gerentes) com os novos filtros
  const comissoesGerentesFiltradas = useMemo(() => {
    let resultado = [...comissoesGerentes];

    // Filtro por gerente
    if (gerenteFiltro !== "todos") {
      resultado = resultado.filter(c => c.beneficiario_id === gerenteFiltro);
    }

    // Filtro por vendedor da equipe
    if (vendedorEquipeFiltro !== "todos") {
      resultado = resultado.filter(c => c.vendedor_origem_id === vendedorEquipeFiltro);
    }

    // Filtro por status
    if (statusHierarquicoFiltro !== "todos") {
      resultado = resultado.filter(c => c.status === statusHierarquicoFiltro);
    }

    // Busca textual
    if (gerenteSearchTerm) {
      const term = gerenteSearchTerm.toLowerCase();
      resultado = resultado.filter(c =>
        c.beneficiario_nome?.toLowerCase().includes(term) ||
        c.vendedor_origem_nome?.toLowerCase().includes(term) ||
        c.cliente_nome?.toLowerCase().includes(term)
      );
    }

    return resultado;
  }, [comissoesGerentes, gerenteFiltro, vendedorEquipeFiltro, statusHierarquicoFiltro, gerenteSearchTerm]);

  // Vendedores vinculados a gerentes (para filtro)
  const vendedoresVinculados = useMemo(() => {
    return vendedores.filter(v => v.gerente_id !== null && v.gerente_id !== undefined);
  }, [vendedores]);

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
      // Resolve bling_order_id from parcela or shopify_pedido
      const blingOrderId = p.bling_order_id || p.shopify_pedido?.bling_order_id || null;
      // Sempre permitir vínculo manual para admins quando não há link_danfe
      const canSearch = true;
      
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
        bling_order_number: p.nota_fiscal_numero 
          ? `NF ${p.nota_fiscal_numero}` 
          : p.shopify_pedido?.nota_fiscal_numero 
            ? `NF ${p.shopify_pedido.nota_fiscal_numero}`
            : (p.bling_order_number || p.proposta?.bling_order_number || null),
        link_danfe: p.link_danfe || p.shopify_pedido?.nota_fiscal_url || p.proposta?.link_danfe || null,
        bling_order_id: blingOrderId,
        canSearchBlingOrder: canSearch,
        shopify_order_number: p.shopify_pedido?.order_number || null,
        customer_email: p.shopify_pedido?.customer_email || null,
        order_value: p.shopify_pedido?.valor_total || p.valor || null,
        order_date: p.shopify_pedido?.order_date || p.data_vencimento || null,
        shopify_pedido_id: p.shopify_pedido?.id || p.shopify_pedido_id || null,
        isFetchingNfe: fetchingNfeIds.has(p.id)
      };
    });
  }, [parcelas, statusSelecionado, vendedorSelecionado, tipoSelecionado, searchTerm, clienteMap, vendedorById, vendedorByEmail, fetchingNfeIds]);

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

  // Mutation: backfill bling_order_id para itens sem vínculo
  const backfillBlingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('backfill-bling-order-ids', {});
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
      toast.success(data.message || `Backfill concluído: ${data.updated} atualizados`);
    },
    onError: (error) => {
      console.error("Erro ao executar backfill:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao executar backfill");
    },
  });

  // Mutation: sincronizar NF/DANFE em lote
  const syncNfDanfeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-nf-danfe-batch', {});
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
      toast.success(data.message || 'Sincronização concluída');
    },
    onError: (error) => {
      console.error("Erro ao sincronizar NF/DANFE:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao sincronizar NF/DANFE");
    },
  });

  // Mutation: sincronização completa de NF-e para comissões online
  const syncComissoesNfeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-comissoes-nfe', {});
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
      queryClient.invalidateQueries({ queryKey: ["shopify-pedidos-pendentes-bling"] });
      toast.success(data.message || 'Sincronização concluída');
    },
    onError: (error) => {
      console.error("Erro ao sincronizar comissões:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao sincronizar comissões");
    },
  });

  // Mutation: sincronizar pedidos Shopify de vendedores com Bling
  const syncShopifyBlingMutation = useMutation({
    mutationFn: async () => {
      const pedidoIds = pedidosShopifyPendentes.map(p => p.id);
      if (pedidoIds.length === 0) {
        throw new Error('Nenhum pedido Shopify pendente de sincronização');
      }
      
      const { data, error } = await supabase.functions.invoke('bling-sync-shopify-orders', {
        body: { pedido_ids: pedidoIds }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao sincronizar pedidos');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shopify-pedidos-pendentes-bling"] });
      queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
      toast.success(`${data.synced || 0} pedidos Shopify sincronizados com Bling!`);
      
      // Após sincronizar pedidos, sincronizar NF/DANFE automaticamente
      setTimeout(() => {
        syncNfDanfeMutation.mutate();
      }, 1000);
    },
    onError: (error) => {
      console.error("Erro ao sincronizar pedidos Shopify:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao sincronizar pedidos Shopify");
    },
  });

  // Mutation: buscar NF no Bling (com descoberta de bling_order_id se necessário)
  const buscarNfeMutation = useMutation({
    mutationFn: async (params: { 
      parcelaId: string; 
      blingOrderId?: number | null;
      shopifyOrderNumber?: string | null;
      customerEmail?: string | null;
      orderValue?: number | null;
      orderDate?: string | null;
      shopifyPedidoId?: string | null;
    }) => {
      // Debug: confirmar payload recebido do clique da lupa
      console.groupCollapsed('[NF] Clique lupa - params recebidos');
      console.log('params:', params);
      console.groupEnd();

      setFetchingNfeIds(prev => new Set(prev).add(params.parcelaId));
      
      let blingOrderId = params.blingOrderId;
      
      // If no blingOrderId, show clear error instead of trying to discover
      if (!blingOrderId) {
        console.warn('[buscarNfe] bling_order_id is NULL - cannot search for NF-e');
        throw new Error('Pedido sem vínculo com Bling. Reprocessar pedido ou atualizar vínculo manualmente.');
      }

      // Debug: payload EXATO que vai para bling-get-nfe-by-order-id
      const payload = { blingOrderId };
      console.groupCollapsed('[NF] Payload → bling-get-nfe-by-order-id');
      console.log(JSON.stringify(payload));
      console.groupEnd();
      
      // Now fetch the NFe with the blingOrderId
      const { data, error } = await supabase.functions.invoke('bling-get-nfe-by-order-id', {
        body: payload
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao buscar NF');
      
      return { parcelaId: params.parcelaId, ...data, _debugPayload: payload };
    },
    onSuccess: async (data) => {
      setFetchingNfeIds(prev => {
        const next = new Set(prev);
        next.delete(data.parcelaId);
        return next;
      });
      
      // A edge function retorna: linkDanfe, nfeNumero, situacaoId
      if (data.found && data.linkDanfe) {
        // Atualizar a parcela no banco
        await supabase
          .from('vendedor_propostas_parcelas')
          .update({
            link_danfe: data.linkDanfe,
            nota_fiscal_numero: data.nfeNumero || null
          })
          .eq('id', data.parcelaId);
        
        queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
        toast.success(`NF ${data.nfeNumero || ''} encontrada!`);
      } else {
        toast.info(data.message || "NF ainda não disponível");
      }
    },
    onError: (error, variables) => {
      setFetchingNfeIds(prev => {
        const next = new Set(prev);
        next.delete(variables.parcelaId);
        return next;
      });
      console.error("Erro ao buscar NF:", error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar NF no Bling';
      toast.error(errorMessage);
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

  const handleBuscarNfe = (params: {
    parcelaId: string;
    blingOrderId?: number | null;
    shopifyOrderNumber?: string | null;
    customerEmail?: string | null;
    orderValue?: number | null;
    orderDate?: string | null;
    shopifyPedidoId?: string | null;
  }) => {
    buscarNfeMutation.mutate(params);
  };

  // Handler para refazer busca de NF - limpa NF existente e busca novamente
  const handleRefazerNfe = async (params: {
    parcelaId: string;
    blingOrderId?: number | null;
    shopifyOrderNumber?: string | null;
    customerEmail?: string | null;
    orderValue?: number | null;
    orderDate?: string | null;
    shopifyPedidoId?: string | null;
  }) => {
    // Primeiro limpa os campos de NF da parcela
    await supabase
      .from('vendedor_propostas_parcelas')
      .update({
        link_danfe: null,
        nota_fiscal_numero: null
      })
      .eq('id', params.parcelaId);
    
    // Depois dispara a busca novamente
    buscarNfeMutation.mutate(params);
  };

  // Handler para abrir dialog de vinculação manual
  const handleVincularManual = (parcelaId: string, clienteNome: string) => {
    setSelectedParcelaVincular({ id: parcelaId, clienteNome });
    setShowVincularDialog(true);
  };

  // Mutation: vincular comissão manualmente (Admin)
  const vincularManualMutation = useMutation({
    mutationFn: async (data: {
      parcelaId: string;
      shopifyPedidoId: string;
      notaFiscalNumero: string;
      linkDanfe: string;
      blingOrderId?: number;
    }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      if (!isAdmin) throw new Error("Apenas administradores podem vincular manualmente");

      // 1. Buscar valores antigos da parcela
      const { data: parcelaAntiga, error: fetchError } = await supabase
        .from("vendedor_propostas_parcelas")
        .select("shopify_pedido_id, nota_fiscal_numero, link_danfe")
        .eq("id", data.parcelaId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Atualizar parcela
      const { error: updateError } = await supabase
        .from("vendedor_propostas_parcelas")
        .update({
          shopify_pedido_id: data.shopifyPedidoId,
          nota_fiscal_numero: data.notaFiscalNumero,
          link_danfe: data.linkDanfe,
        })
        .eq("id", data.parcelaId);

      if (updateError) throw updateError;

      // 3. Se bling_order_id foi informado, verificar e atualizar ebd_shopify_pedidos
      if (data.blingOrderId) {
        const { data: shopifyPedido, error: shopifyFetchError } = await supabase
          .from("ebd_shopify_pedidos")
          .select("id, bling_order_id")
          .eq("id", data.shopifyPedidoId)
          .single();

        if (!shopifyFetchError && shopifyPedido && !shopifyPedido.bling_order_id) {
          await supabase
            .from("ebd_shopify_pedidos")
            .update({
              bling_order_id: data.blingOrderId,
              nota_fiscal_numero: data.notaFiscalNumero,
              nota_fiscal_url: data.linkDanfe,
            })
            .eq("id", data.shopifyPedidoId);
        }
      }

      // 4. Registrar no audit log
      const { error: auditError } = await supabase
        .from("admin_audit_log")
        .insert({
          admin_id: user.id,
          action: "vincular_comissao_manual",
          table_name: "vendedor_propostas_parcelas",
          record_id: data.parcelaId,
          old_values: {
            shopify_pedido_id: parcelaAntiga?.shopify_pedido_id,
            nota_fiscal_numero: parcelaAntiga?.nota_fiscal_numero,
            link_danfe: parcelaAntiga?.link_danfe,
          },
          new_values: {
            shopify_pedido_id: data.shopifyPedidoId,
            nota_fiscal_numero: data.notaFiscalNumero,
            link_danfe: data.linkDanfe,
            bling_order_id: data.blingOrderId || null,
          },
        });

      if (auditError) {
        console.error("Erro ao registrar audit log:", auditError);
        // Não impede a operação, apenas loga
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
      setShowVincularDialog(false);
      setSelectedParcelaVincular(null);
      toast.success("Comissão vinculada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao vincular comissão:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao vincular comissão");
    },
  });

  // Mutation: excluir comissão (Admin)
  const excluirComissaoMutation = useMutation({
    mutationFn: async (parcelaId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      if (!isAdmin) throw new Error("Apenas administradores podem excluir comissões");

      // 1. Buscar dados da parcela para audit log
      const { data: parcelaAntiga, error: fetchError } = await supabase
        .from("vendedor_propostas_parcelas")
        .select("*")
        .eq("id", parcelaId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Excluir a parcela
      const { error: deleteError } = await supabase
        .from("vendedor_propostas_parcelas")
        .delete()
        .eq("id", parcelaId);

      if (deleteError) throw deleteError;

      // 3. Registrar no audit log
      const { error: auditError } = await supabase
        .from("admin_audit_log")
        .insert({
          admin_id: user.id,
          action: "excluir_comissao",
          table_name: "vendedor_propostas_parcelas",
          record_id: parcelaId,
          old_values: parcelaAntiga,
          new_values: null,
        });

      if (auditError) {
        console.error("Erro ao registrar audit log:", auditError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
      toast.success("Comissão excluída com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao excluir comissão:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir comissão");
    },
  });

  // Handler para excluir comissão
  const handleExcluirComissao = (parcelaId: string) => {
    excluirComissaoMutation.mutate(parcelaId);
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
        <TabsList className="grid w-full grid-cols-7 max-w-3xl">
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
          <TabsTrigger value="gerentes" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Gerentes</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="minhas" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">Minhas</span>
            </TabsTrigger>
          )}
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

          {/* Cards de Resumo por Vendedor */}
          <ComissaoResumoVendedoresCards
            vendedores={resumoPorVendedor}
            onVerVendedor={(vendedorId, tab) => {
              setVendedorSelecionado(vendedorId);
              if (tab === 'a_pagar') {
                setStatusSelecionado('liberada');
              }
              setActiveTab(tab === 'a_pagar' ? 'a_pagar' : 'pendentes');
            }}
          />

          {/* Cards de Resumo por Gerente */}
          {(isAdmin || isFinanceiro) && resumoPorGerente.length > 0 && (
            <ComissaoResumoGerentesCards
              gerentes={resumoPorGerente}
              onVerGerente={(gerenteId, status) => {
                setGerenteFiltro(gerenteId);
                setStatusHierarquicoFiltro(status);
                setActiveTab('gerentes');
              }}
            />
          )}

          {/* Card de Resumo do Admin - apenas visível para admin */}
          {isAdmin && resumoAdmin && (resumoAdmin.aPagar > 0 || resumoAdmin.pendentes > 0) && (
            <ComissaoResumoAdminCard
              aPagar={resumoAdmin.aPagar}
              pendentes={resumoAdmin.pendentes}
              quantidadeAPagar={resumoAdmin.quantidadeAPagar}
              quantidadePendentes={resumoAdmin.quantidadePendentes}
              onVerMinhas={(status) => {
                setStatusHierarquicoFiltro(status);
                setActiveTab('minhas');
              }}
            />
          )}

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
                  onBuscarNfe={handleBuscarNfe}
                  onRefazerNfe={handleRefazerNfe}
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

                {/* Botão Backfill Bling - aparece se houver itens sem vínculo */}
                {comissoesFiltradas.some(c => c.canSearchBlingOrder && !c.bling_order_id) && (
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => backfillBlingMutation.mutate()}
                      disabled={backfillBlingMutation.isPending}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${backfillBlingMutation.isPending ? 'animate-spin' : ''}`} />
                      {backfillBlingMutation.isPending ? 'Vinculando...' : 'Vincular Bling'}
                    </Button>
                  </div>
                )}

                {/* Botão Sincronizar NF/DANFE - aparece se houver itens com bling_order_id mas sem link_danfe */}
                {comissoesFiltradas.some(c => c.bling_order_id && !c.link_danfe) && (
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncNfDanfeMutation.mutate()}
                      disabled={syncNfDanfeMutation.isPending}
                      className="gap-2"
                    >
                      <Download className={`h-4 w-4 ${syncNfDanfeMutation.isPending ? 'animate-spin' : ''}`} />
                      {syncNfDanfeMutation.isPending ? 'Sincronizando...' : 'Sincronizar NF/DANFE'}
                    </Button>
                  </div>
                )}

                {/* Botão Sincronizar Pedidos Shopify - aparece se houver pedidos de vendedores sem bling_order_id */}
                {pedidosShopifyPendentes.length > 0 && (
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncShopifyBlingMutation.mutate()}
                      disabled={syncShopifyBlingMutation.isPending}
                      className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      <ShoppingCart className={`h-4 w-4 ${syncShopifyBlingMutation.isPending ? 'animate-pulse' : ''}`} />
                      {syncShopifyBlingMutation.isPending 
                        ? 'Sincronizando...' 
                        : `Sincronizar Shopify (${pedidosShopifyPendentes.length})`}
                    </Button>
                  </div>
                )}

                {/* Botão Sincronização Completa de NF-e - busca bling_order_id + NF automaticamente */}
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncComissoesNfeMutation.mutate()}
                    disabled={syncComissoesNfeMutation.isPending}
                    className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncComissoesNfeMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncComissoesNfeMutation.isPending 
                      ? 'Sincronizando NF-e...' 
                      : 'Sincronizar NF-e (Automático)'}
                  </Button>
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
                  onBuscarNfe={handleBuscarNfe}
                  onRefazerNfe={handleRefazerNfe}
                  onVincularManual={isAdmin ? handleVincularManual : undefined}
                  onExcluir={isAdmin ? handleExcluirComissao : undefined}
                  isUpdating={marcarPagaMutation.isPending || excluirComissaoMutation.isPending}
                  isAdmin={isAdmin}
                />
              ) : (
                <ComissaoTable
                  comissoes={comissoesFiltradas.filter(c => c.comissao_status === 'liberada')}
                  onMarcarPaga={(id) => marcarPagaMutation.mutate(id)}
                  onBuscarNfe={handleBuscarNfe}
                  onRefazerNfe={handleRefazerNfe}
                  onVincularManual={isAdmin ? handleVincularManual : undefined}
                  onExcluir={isAdmin ? handleExcluirComissao : undefined}
                  isUpdating={marcarPagaMutation.isPending || excluirComissaoMutation.isPending}
                  isAdmin={isAdmin}
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
                onBuscarNfe={handleBuscarNfe}
                onRefazerNfe={handleRefazerNfe}
                isUpdating={marcarPagaMutation.isPending}
                showActions={true}
                isAdmin={isAdmin}
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
                onBuscarNfe={handleBuscarNfe}
                showActions={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA GERENTES ============ */}
        <TabsContent value="gerentes" className="space-y-6">
          {/* Filtros */}
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
                      placeholder="Cliente, gerente..."
                      value={gerenteSearchTerm}
                      onChange={(e) => setGerenteSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="w-44">
                  <label className="text-sm font-medium mb-1 block">Gerente</label>
                  <Select value={gerenteFiltro} onValueChange={setGerenteFiltro}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {gerentes.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-44">
                  <label className="text-sm font-medium mb-1 block">Vendedor da Equipe</label>
                  <Select value={vendedorEquipeFiltro} onValueChange={setVendedorEquipeFiltro}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {vendedoresVinculados.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-36">
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select value={statusHierarquicoFiltro} onValueChange={setStatusHierarquicoFiltro}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="liberada">Liberada</SelectItem>
                      <SelectItem value="paga">Paga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Comissões dos Gerentes ({comissoesGerentesFiltradas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ComissaoHierarquicaTable
                comissoes={comissoesGerentesFiltradas}
                onMarcarPaga={(id) => marcarHierarquicaPagaMutation.mutate(id)}
                isUpdating={marcarHierarquicaPagaMutation.isPending}
                tipo="gerente"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ABA MINHAS (ADMIN) ============ */}
        {isAdmin && (
          <TabsContent value="minhas" className="space-y-6">
            <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
              <CardHeader>
                <CardTitle className="text-amber-700 flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Minhas Comissões (Admin 1.5%)
                </CardTitle>
                <p className="text-sm text-amber-600">
                  Comissão de 1.5% sobre todas as vendas da operação
                </p>
              </CardHeader>
              <CardContent>
                <ComissaoHierarquicaTable
                  comissoes={comissoesAdmin}
                  onMarcarPaga={(id) => marcarHierarquicaPagaMutation.mutate(id)}
                  isUpdating={marcarHierarquicaPagaMutation.isPending}
                  tipo="admin"
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

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

      {/* Dialog de Vinculação Manual (Admin) */}
      {selectedParcelaVincular && (
        <VincularComissaoDialog
          open={showVincularDialog}
          onOpenChange={(open) => {
            setShowVincularDialog(open);
            if (!open) setSelectedParcelaVincular(null);
          }}
          parcelaId={selectedParcelaVincular.id}
          clienteNome={selectedParcelaVincular.clienteNome}
          onConfirm={(data) => vincularManualMutation.mutate(data)}
          isLoading={vincularManualMutation.isPending}
        />
      )}
    </div>
  );
}
