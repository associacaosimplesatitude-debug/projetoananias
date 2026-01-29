import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, BarChart3, TrendingUp, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RoyaltiesRelatorios() {
  const [tipoRelatorio, setTipoRelatorio] = useState<"vendas" | "comissoes" | "pagamentos">("vendas");
  const [periodo, setPeriodo] = useState("ultimos_3_meses");
  const [dataInicio, setDataInicio] = useState(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: dadosRelatorio = [], isLoading } = useQuery({
    queryKey: ["royalties-relatorio", tipoRelatorio, dataInicio, dataFim],
    queryFn: async () => {
      if (tipoRelatorio === "vendas") {
        const { data, error } = await supabase
          .from("royalties_vendas")
          .select(`
            id,
            data_venda,
            quantidade,
            valor_unitario,
            valor_comissao_total,
            royalties_livros (
              titulo,
              royalties_autores (nome_completo)
            )
          `)
          .gte("data_venda", dataInicio)
          .lte("data_venda", dataFim)
          .order("data_venda", { ascending: false });

        if (error) throw error;
        return data || [];
      } else if (tipoRelatorio === "comissoes") {
        const { data, error } = await supabase
          .from("royalties_vendas")
          .select(`
            id,
            data_venda,
            quantidade,
            valor_comissao_total,
            pagamento_id,
            royalties_livros (
              titulo,
              royalties_autores (nome_completo)
            )
          `)
          .gte("data_venda", dataInicio)
          .lte("data_venda", dataFim)
          .order("data_venda", { ascending: false });

        if (error) throw error;
        return data || [];
      } else {
        const { data, error } = await supabase
          .from("royalties_pagamentos")
          .select(`
            id,
            data_prevista,
            data_efetivacao,
            valor_total,
            status,
            royalties_autores (nome_completo)
          `)
          .gte("data_prevista", dataInicio)
          .lte("data_prevista", dataFim)
          .order("data_prevista", { ascending: false });

        if (error) throw error;
        return data || [];
      }
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handlePeriodoChange = (value: string) => {
    setPeriodo(value);
    const hoje = new Date();
    
    switch (value) {
      case "ultimo_mes":
        setDataInicio(format(startOfMonth(subMonths(hoje, 1)), "yyyy-MM-dd"));
        setDataFim(format(endOfMonth(subMonths(hoje, 1)), "yyyy-MM-dd"));
        break;
      case "ultimos_3_meses":
        setDataInicio(format(subMonths(hoje, 3), "yyyy-MM-dd"));
        setDataFim(format(hoje, "yyyy-MM-dd"));
        break;
      case "ultimos_6_meses":
        setDataInicio(format(subMonths(hoje, 6), "yyyy-MM-dd"));
        setDataFim(format(hoje, "yyyy-MM-dd"));
        break;
      case "este_ano":
        setDataInicio(format(new Date(hoje.getFullYear(), 0, 1), "yyyy-MM-dd"));
        setDataFim(format(hoje, "yyyy-MM-dd"));
        break;
      default:
        break;
    }
  };

  const calcularTotais = () => {
    if (tipoRelatorio === "vendas" || tipoRelatorio === "comissoes") {
      const totalQtd = dadosRelatorio.reduce((acc: number, v: any) => acc + (v.quantidade || 0), 0);
      const totalComissao = dadosRelatorio.reduce((acc: number, v: any) => acc + Number(v.valor_comissao_total || 0), 0);
      return { totalQtd, totalComissao };
    } else {
      const totalPago = dadosRelatorio.filter((p: any) => p.status === "pago").reduce((acc: number, p: any) => acc + Number(p.valor_total || 0), 0);
      const totalPendente = dadosRelatorio.filter((p: any) => p.status === "pendente").reduce((acc: number, p: any) => acc + Number(p.valor_total || 0), 0);
      return { totalPago, totalPendente };
    }
  };

  const totais = calcularTotais();

  const relatorioTipos = [
    { value: "vendas", label: "Relatório de Vendas", icon: BarChart3 },
    { value: "comissoes", label: "Relatório de Comissões", icon: TrendingUp },
    { value: "pagamentos", label: "Relatório de Pagamentos", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">
          Gere relatórios detalhados do sistema de royalties
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Tipo de Relatório</Label>
              <Select value={tipoRelatorio} onValueChange={(v: any) => setTipoRelatorio(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {relatorioTipos.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={periodo} onValueChange={handlePeriodoChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ultimo_mes">Último Mês</SelectItem>
                  <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
                  <SelectItem value="ultimos_6_meses">Últimos 6 Meses</SelectItem>
                  <SelectItem value="este_ano">Este Ano</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPeriodo("personalizado");
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPeriodo("personalizado");
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {tipoRelatorio === "pagamentos" ? "Registros" : "Total de Vendas"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tipoRelatorio === "pagamentos" 
                ? dadosRelatorio.length 
                : (totais as any).totalQtd || 0} 
              {tipoRelatorio !== "pagamentos" && " unidades"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {tipoRelatorio === "pagamentos" ? "Total Pago" : "Total Comissões"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(
                tipoRelatorio === "pagamentos" 
                  ? (totais as any).totalPago || 0 
                  : (totais as any).totalComissao || 0
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {tipoRelatorio === "pagamentos" ? "Total Pendente" : "Período"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tipoRelatorio === "pagamentos" 
                ? formatCurrency((totais as any).totalPendente || 0)
                : `${format(new Date(dataInicio), "dd/MM", { locale: ptBR })} - ${format(new Date(dataFim), "dd/MM/yy", { locale: ptBR })}`
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Dados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {relatorioTipos.find(t => t.value === tipoRelatorio)?.label}
              </CardTitle>
              <CardDescription>
                {dadosRelatorio.length} registros encontrados
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : dadosRelatorio.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro encontrado para o período selecionado.
            </div>
          ) : tipoRelatorio === "pagamentos" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Autor</TableHead>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Data Efetivação</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosRelatorio.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.royalties_autores?.nome_completo || "-"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {item.data_efetivacao 
                        ? format(new Date(item.data_efetivacao), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.valor_total)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === "pago" 
                          ? "bg-green-100 text-green-800" 
                          : item.status === "cancelado"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {item.status === "pago" ? "Pago" : item.status === "cancelado" ? "Cancelado" : "Pendente"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Livro</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  {tipoRelatorio === "comissoes" && <TableHead>Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosRelatorio.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {format(new Date(item.data_venda), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.royalties_livros?.titulo || "-"}
                    </TableCell>
                    <TableCell>
                      {item.royalties_livros?.royalties_autores?.nome_completo || "-"}
                    </TableCell>
                    <TableCell className="text-right">{item.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.valor_comissao_total)}
                    </TableCell>
                    {tipoRelatorio === "comissoes" && (
                      <TableCell>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          item.pagamento_id 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {item.pagamento_id ? "Pago" : "Pendente"}
                        </span>
                      </TableCell>
                    )}
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
