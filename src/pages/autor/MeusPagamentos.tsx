import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, DollarSign, Clock, CheckCircle, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";
import { format, isPast, isFuture, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AutorMeusPagamentos() {
  const { autorId } = useRoyaltiesAuth();

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ["autor-pagamentos", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      const { data, error } = await supabase
        .from("royalties_pagamentos")
        .select("*")
        .eq("autor_id", autorId)
        .order("data_prevista", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!autorId,
  });

  // Get pending sales not yet in any payment
  const { data: vendasPendentes = [] } = useQuery({
    queryKey: ["autor-vendas-pendentes", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      if (!livros || livros.length === 0) return [];

      const livroIds = livros.map(l => l.id);

      const { data, error } = await supabase
        .from("royalties_vendas")
        .select("id, valor_comissao_total")
        .in("livro_id", livroIds)
        .is("pagamento_id", null);

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

  const getStatusVariant = (status: string, dataPrevista: string) => {
    if (status === "pago") return "default";
    if (status === "cancelado") return "destructive";
    
    // Check if overdue
    if (status === "pendente" && isPast(parseISO(dataPrevista))) {
      return "destructive";
    }
    
    return "secondary";
  };

  const getStatusLabel = (status: string, dataPrevista: string) => {
    if (status === "pago") return "Pago";
    if (status === "cancelado") return "Cancelado";
    
    if (status === "pendente" && isPast(parseISO(dataPrevista))) {
      return "Atrasado";
    }
    
    return "Pendente";
  };

  const totalRecebido = pagamentos
    .filter((p) => p.status === "pago")
    .reduce((acc, p) => acc + Number(p.valor_total || 0), 0);

  const totalPendente = pagamentos
    .filter((p) => p.status === "pendente")
    .reduce((acc, p) => acc + Number(p.valor_total || 0), 0);

  const totalNaoFaturado = vendasPendentes.reduce(
    (acc, v) => acc + Number(v.valor_comissao_total || 0),
    0
  );

  const proximoPagamento = pagamentos.find(
    p => p.status === "pendente" && isFuture(parseISO(p.data_prevista))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meus Pagamentos</h1>
        <p className="text-muted-foreground">
          Acompanhe seus pagamentos de royalties
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalRecebido)}
            </div>
            <p className="text-xs text-muted-foreground">
              Desde o início
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendado</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalPendente)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagamentos agendados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Faturar</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(totalNaoFaturado)}
            </div>
            <p className="text-xs text-muted-foreground">
              Vendas não faturadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximo Pagamento</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {proximoPagamento ? (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(proximoPagamento.valor_total)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(proximoPagamento.data_prevista), "dd 'de' MMMM", { locale: ptBR })}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">-</div>
                <p className="text-xs text-muted-foreground">
                  Nenhum agendado
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
          <CardDescription>
            {pagamentos.length} pagamentos registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : pagamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pagamento registrado ainda.</p>
              <p className="text-sm mt-1">
                Os pagamentos serão exibidos aqui quando forem programados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referência</TableHead>
                    <TableHead>Data Prevista</TableHead>
                    <TableHead>Data Efetivação</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comprovante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {pagamentos.map((pagamento) => (
                    <TableRow key={pagamento.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(pagamento.data_prevista), "MMM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {format(parseISO(pagamento.data_prevista), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {pagamento.data_efetivacao
                          ? format(parseISO(pagamento.data_efetivacao), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(pagamento.valor_total)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getStatusVariant(
                            pagamento.status || "pendente", 
                            pagamento.data_prevista
                          )}
                        >
                          {getStatusLabel(
                            pagamento.status || "pendente",
                            pagamento.data_prevista
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pagamento.comprovante_url ? (
                          <Button variant="ghost" size="sm" asChild>
                            <a 
                              href={pagamento.comprovante_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1"
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only md:not-sr-only md:inline">
                                Baixar
                              </span>
                            </a>
                          </Button>
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
    </div>
  );
}
