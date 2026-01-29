import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Filter, TrendingUp, DollarSign, Clock, FileText, FileSpreadsheet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportToPDF, exportToExcel } from "@/utils/royaltiesExport";

export default function AutorExtrato() {
  const { autorId } = useRoyaltiesAuth();
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");
  const [livroFiltro, setLivroFiltro] = useState("todos");

  const { data: livros = [] } = useQuery({
    queryKey: ["autor-livros-filter", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      const { data, error } = await supabase
        .from("royalties_livros")
        .select("id, titulo")
        .eq("autor_id", autorId)
        .order("titulo");

      if (error) throw error;
      return data || [];
    },
    enabled: !!autorId,
  });

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ["autor-extrato", autorId, periodoFiltro, livroFiltro],
    queryFn: async () => {
      if (!autorId) return [];

      // First get the author's books
      const { data: livrosData } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      if (!livrosData || livrosData.length === 0) return [];

      let livroIds = livrosData.map((l) => l.id);
      
      // Apply book filter
      if (livroFiltro !== "todos") {
        livroIds = livroIds.filter(id => id === livroFiltro);
      }

      if (livroIds.length === 0) return [];

      // Build query
      let query = supabase
        .from("royalties_vendas")
        .select(`
          *,
          royalties_livros (titulo)
        `)
        .in("livro_id", livroIds)
        .order("data_venda", { ascending: false });

      // Apply period filter
      if (periodoFiltro !== "todos") {
        const now = new Date();
        let startDate: Date;
        
        switch (periodoFiltro) {
          case "mes_atual":
            startDate = startOfMonth(now);
            break;
          case "ultimo_mes":
            startDate = startOfMonth(subMonths(now, 1));
            query = query.lte("data_venda", format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd"));
            break;
          case "3_meses":
            startDate = startOfMonth(subMonths(now, 2));
            break;
          case "6_meses":
            startDate = startOfMonth(subMonths(now, 5));
            break;
          case "12_meses":
            startDate = startOfMonth(subMonths(now, 11));
            break;
          default:
            startDate = new Date(0);
        }
        
        if (periodoFiltro !== "ultimo_mes") {
          query = query.gte("data_venda", format(startDate, "yyyy-MM-dd"));
        } else {
          query = query.gte("data_venda", format(startDate, "yyyy-MM-dd"));
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!autorId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalVendas = vendas.length;
  const totalQuantidade = vendas.reduce((acc, v) => acc + v.quantidade, 0);
  const totalComissao = vendas.reduce((acc, v) => acc + Number(v.valor_comissao_total || 0), 0);
  const comissaoPaga = vendas
    .filter(v => v.pagamento_id)
    .reduce((acc, v) => acc + Number(v.valor_comissao_total || 0), 0);
  const comissaoPendente = totalComissao - comissaoPaga;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Extrato de Vendas</h1>
        <p className="text-muted-foreground">
          Acompanhe todas as vendas dos seus livros
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVendas}</div>
            <p className="text-xs text-muted-foreground">
              {totalQuantidade} unidades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Comissões</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalComissao)}</div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(comissaoPaga)}
            </div>
            <p className="text-xs text-muted-foreground">
              Já pago
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(comissaoPendente)}
            </div>
            <p className="text-xs text-muted-foreground">
              Aguardando pagamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os períodos</SelectItem>
                  <SelectItem value="mes_atual">Mês atual</SelectItem>
                  <SelectItem value="ultimo_mes">Último mês</SelectItem>
                  <SelectItem value="3_meses">Últimos 3 meses</SelectItem>
                  <SelectItem value="6_meses">Últimos 6 meses</SelectItem>
                  <SelectItem value="12_meses">Últimos 12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-56">
              <Select value={livroFiltro} onValueChange={setLivroFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Livro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os livros</SelectItem>
                  {livros.map((livro: any) => (
                    <SelectItem key={livro.id} value={livro.id}>
                      {livro.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de Vendas</CardTitle>
              <CardDescription>
                {vendas.length} vendas encontradas
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={vendas.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem 
                  onClick={() => {
                    const hoje = new Date();
                    const dataInicio = periodoFiltro === "todos" 
                      ? "2020-01-01" 
                      : format(startOfMonth(subMonths(hoje, periodoFiltro === "mes_atual" ? 0 : periodoFiltro === "ultimo_mes" ? 1 : periodoFiltro === "3_meses" ? 2 : periodoFiltro === "6_meses" ? 5 : 11)), "yyyy-MM-dd");
                    exportToPDF({ 
                      tipoRelatorio: "comissoes", 
                      dataInicio, 
                      dataFim: format(hoje, "yyyy-MM-dd"), 
                      dados: vendas 
                    });
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    const hoje = new Date();
                    const dataInicio = periodoFiltro === "todos" 
                      ? "2020-01-01" 
                      : format(startOfMonth(subMonths(hoje, periodoFiltro === "mes_atual" ? 0 : periodoFiltro === "ultimo_mes" ? 1 : periodoFiltro === "3_meses" ? 2 : periodoFiltro === "6_meses" ? 5 : 11)), "yyyy-MM-dd");
                    exportToExcel({ 
                      tipoRelatorio: "comissoes", 
                      dataInicio, 
                      dataFim: format(hoje, "yyyy-MM-dd"), 
                      dados: vendas 
                    });
                  }}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : vendas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda encontrada no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Livro</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-right">Comissão Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendas.map((venda: any) => (
                    <TableRow key={venda.id}>
                      <TableCell>
                        {format(new Date(venda.data_venda), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {venda.royalties_livros?.titulo || "-"}
                      </TableCell>
                      <TableCell className="text-right">{venda.quantidade}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(venda.valor_comissao_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(venda.valor_comissao_total)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={venda.pagamento_id ? "default" : "secondary"}>
                          {venda.pagamento_id ? "Pago" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
