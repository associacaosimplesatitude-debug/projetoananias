import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Calendar, DollarSign, Clock, AlertTriangle, CheckCircle2, Filter } from "lucide-react";
import { format, parseISO, isBefore, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useVendedor } from "@/hooks/useVendedor";

interface Parcela {
  id: string;
  proposta_id: string;
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
}

interface Cliente {
  id: string;
  nome_igreja: string;
}

export default function VendedorParcelas() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { vendedor, isLoading: vendedorLoading } = useVendedor();
  
  const mesParam = searchParams.get("mes");
  const [mesSelecionado, setMesSelecionado] = useState<string>(mesParam || "todos");
  const [statusSelecionado, setStatusSelecionado] = useState<string>("todos");

  // Fetch parcelas
  const { data: parcelas = [], isLoading: parcelasLoading } = useQuery({
    queryKey: ["vendedor-todas-parcelas", vendedor?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedor_propostas_parcelas")
        .select("*")
        .eq("vendedor_id", vendedor!.id)
        .order("data_vencimento", { ascending: true });
      
      if (error) throw error;
      return data as Parcela[];
    },
    enabled: !!vendedor?.id,
  });

  // Fetch clientes para mapear nomes
  const clienteIds = [...new Set(parcelas.map(p => p.cliente_id).filter(Boolean))];
  const { data: clientes = [] } = useQuery({
    queryKey: ["vendedor-parcelas-clientes", clienteIds],
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

  const clienteMap = useMemo(() => {
    return new Map(clientes.map(c => [c.id, c.nome_igreja]));
  }, [clientes]);

  // Generate month options for filter
  const mesesDisponiveis = useMemo(() => {
    const meses = new Set<string>();
    const hoje = new Date();
    
    // Add current and next 6 months
    for (let i = -1; i <= 6; i++) {
      const mes = addMonths(hoje, i);
      meses.add(format(mes, "yyyy-MM"));
    }
    
    // Add months from parcelas
    parcelas.forEach(p => {
      const mes = format(parseISO(p.data_vencimento), "yyyy-MM");
      meses.add(mes);
    });
    
    return Array.from(meses).sort();
  }, [parcelas]);

  // Filter parcelas
  const parcelasFiltradas = useMemo(() => {
    let resultado = [...parcelas];
    const hoje = new Date();
    
    // Update status based on date
    resultado = resultado.map(p => {
      if (p.status === 'paga') return p;
      const vencimento = parseISO(p.data_vencimento);
      const statusAtualizado = isBefore(vencimento, hoje) ? 'atrasada' : 'aguardando';
      return { ...p, status: statusAtualizado };
    });

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

    return resultado;
  }, [parcelas, mesSelecionado, statusSelecionado]);

  // Calculate totals
  const totais = useMemo(() => {
    return {
      valor: parcelasFiltradas.reduce((sum, p) => sum + Number(p.valor || 0), 0),
      comissao: parcelasFiltradas.reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0),
      quantidade: parcelasFiltradas.length,
      pagas: parcelasFiltradas.filter(p => p.status === 'paga').length,
      aguardando: parcelasFiltradas.filter(p => p.status === 'aguardando').length,
      atrasadas: parcelasFiltradas.filter(p => p.status === 'atrasada').length,
    };
  }, [parcelasFiltradas]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paga':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paga
          </Badge>
        );
      case 'atrasada':
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
    if (origem === 'mercadopago') {
      return <Badge variant="outline" className="text-blue-600 border-blue-300">Mercado Pago</Badge>;
    }
    return <Badge variant="outline">Faturado</Badge>;
  };

  if (vendedorLoading || parcelasLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/vendedor")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Minhas Parcelas</h2>
          <p className="text-muted-foreground">
            Acompanhe as parcelas e comissões dos seus pedidos
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Parcelas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totais.quantidade}</div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Pagas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{totais.pagas}</div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700">Aguardando</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{totais.aguardando}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{totais.atrasadas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Comissão Total */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-green-600">Comissão total (filtro atual)</p>
                <p className="text-2xl font-bold text-green-700">
                  R$ {totais.comissao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-600">Valor das parcelas</p>
              <p className="text-lg font-semibold text-green-700">
                R$ {totais.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <label className="text-sm font-medium mb-1 block">Mês de Vencimento</label>
              <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os meses" />
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
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={statusSelecionado} onValueChange={setStatusSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="paga">Pagas</SelectItem>
                  <SelectItem value="atrasada">Atrasadas</SelectItem>
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelasFiltradas.map((parcela) => (
                  <TableRow key={parcela.id}>
                    <TableCell className="font-medium">
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
                      {getStatusBadge(parcela.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
