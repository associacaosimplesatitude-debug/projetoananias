import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { 
  Calendar, DollarSign, Clock, AlertTriangle, CheckCircle2, 
  Filter, Users, TrendingUp, Search, CreditCard, FileText
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

export default function GestaoComissoes() {
  const queryClient = useQueryClient();
  const [mesSelecionado, setMesSelecionado] = useState<string>(format(new Date(), "yyyy-MM"));
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

  // Fetch all vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ["admin-vendedores-comissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome, comissao_percentual")
        .eq("status", "ativo")
        .order("nome");
      
      if (error) throw error;
      return data as Vendedor[];
    },
  });

  // Fetch clientes
  const clienteIds = [...new Set(parcelas.map(p => p.cliente_id).filter(Boolean))];
  const { data: clientes = [] } = useQuery({
    queryKey: ["admin-parcelas-clientes", clienteIds],
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

  const clienteMap = useMemo(() => new Map(clientes.map(c => [c.id, c.nome_igreja])), [clientes]);
  const vendedorMap = useMemo(() => new Map(vendedores.map(v => [v.id, v.nome])), [vendedores]);

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
    
    return Array.from(meses).sort();
  }, [parcelas]);

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
      resultado = resultado.filter(p => p.origem === origemSelecionada);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      resultado = resultado.filter(p => {
        const cliente = clienteMap.get(p.cliente_id)?.toLowerCase() || "";
        const vendedor = vendedorMap.get(p.vendedor_id)?.toLowerCase() || "";
        return cliente.includes(term) || vendedor.includes(term);
      });
    }

    return resultado;
  }, [parcelas, mesSelecionado, statusSelecionado, vendedorSelecionado, origemSelecionada, searchTerm, clienteMap, vendedorMap]);

  // Calculate totals
  const totais = useMemo(() => {
    const todas = parcelas.filter(p => {
      if (mesSelecionado === "todos") return true;
      return format(parseISO(p.data_vencimento), "yyyy-MM") === mesSelecionado;
    });

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
  }, [parcelas, parcelasFiltradas, mesSelecionado]);

  // Summary by vendedor
  const resumoPorVendedor = useMemo(() => {
    const resumo = new Map<string, { total: number; comissao: number; pagas: number; pendentes: number }>();
    
    parcelasFiltradas.forEach(p => {
      const current = resumo.get(p.vendedor_id) || { total: 0, comissao: 0, pagas: 0, pendentes: 0 };
      current.total += Number(p.valor || 0);
      current.comissao += Number(p.valor_comissao || 0);
      if (p.status === "paga") {
        current.pagas++;
      } else {
        current.pendentes++;
      }
      resumo.set(p.vendedor_id, current);
    });

    return Array.from(resumo.entries())
      .map(([vendedorId, data]) => ({
        vendedorId,
        vendedorNome: vendedorMap.get(vendedorId) || "Desconhecido",
        ...data,
      }))
      .sort((a, b) => b.comissao - a.comissao);
  }, [parcelasFiltradas, vendedorMap]);

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
    if (origem === "mercadopago") {
      return <Badge variant="outline" className="text-blue-600 border-blue-300">MP</Badge>;
    }
    return <Badge variant="outline">Faturado</Badge>;
  };

  const getMetodoPagamentoBadge = (metodo: string | null) => {
    if (!metodo) return null;
    
    const metodosMap: Record<string, { label: string; icon: JSX.Element }> = {
      pix: { label: "PIX", icon: <DollarSign className="h-3 w-3" /> },
      cartao: { label: "Cartão", icon: <CreditCard className="h-3 w-3" /> },
      cartao_debito: { label: "Débito", icon: <CreditCard className="h-3 w-3" /> },
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

  if (parcelasLoading) {
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
          Acompanhe e gerencie as comissões de todos os vendedores
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Comissão Paga</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              R$ {totais.comissaoPaga.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-green-600">{totais.pagas} parcelas pagas</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">Comissão Pendente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">
              R$ {totais.comissaoPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-yellow-600">{totais.aguardando + totais.atrasadas} parcelas pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Parcelas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totais.quantidade}</div>
            <p className="text-xs text-muted-foreground">no período selecionado</p>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{totais.atrasadas}</div>
            <p className="text-xs text-red-600">requerem atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Vendedor */}
      {resumoPorVendedor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Resumo por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {resumoPorVendedor.slice(0, 6).map((item) => (
                <div
                  key={item.vendedorId}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div>
                    <p className="font-medium">{item.vendedorNome}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.pagas} pagas • {item.pendentes} pendentes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      R$ {item.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="faturado">Faturado</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {parcelasFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma parcela encontrada com os filtros selecionados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelasFiltradas.slice(0, 100).map((parcela) => (
                  <TableRow key={parcela.id}>
                    <TableCell className="font-medium">
                      {vendedorMap.get(parcela.vendedor_id) || "—"}
                    </TableCell>
                    <TableCell>
                      {clienteMap.get(parcela.cliente_id) || "—"}
                    </TableCell>
                    <TableCell>
                      {parcela.numero_parcela}/{parcela.total_parcelas}
                    </TableCell>
                    <TableCell>
                      R$ {Number(parcela.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      R$ {Number(parcela.valor_comissao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(parcela.data_vencimento), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {getOrigemBadge(parcela.origem)}
                    </TableCell>
                    <TableCell>
                      {getMetodoPagamentoBadge(parcela.metodo_pagamento)}
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
          )}
          {parcelasFiltradas.length > 100 && (
            <div className="p-4 text-center text-muted-foreground text-sm border-t">
              Mostrando 100 de {parcelasFiltradas.length} parcelas. Use os filtros para refinar a busca.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
