import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, DollarSign, ShoppingCart, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";

export default function AutorDashboard() {
  const { autorId } = useRoyaltiesAuth();

  const { data: stats } = useQuery({
    queryKey: ["autor-stats", autorId],
    queryFn: async () => {
      if (!autorId) return null;

      // Get books count
      const { count: livrosCount } = await supabase
        .from("royalties_livros")
        .select("*", { count: "exact", head: true })
        .eq("autor_id", autorId)
        .eq("is_active", true);

      // Get total earnings
      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", autorId);

      const livroIds = livros?.map((l) => l.id) || [];

      let totalGanhos = 0;
      let vendasMes = 0;

      if (livroIds.length > 0) {
        const { data: vendas } = await supabase
          .from("royalties_vendas")
          .select("valor_comissao_total, quantidade, data_venda")
          .in("livro_id", livroIds);

        totalGanhos = vendas?.reduce((acc, v) => acc + Number(v.valor_comissao_total || 0), 0) || 0;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        vendasMes = vendas?.filter(
          (v) => new Date(v.data_venda) >= startOfMonth
        ).reduce((acc, v) => acc + (v.quantidade || 0), 0) || 0;
      }

      // Get pending payments
      const { data: pagamentosPendentes } = await supabase
        .from("royalties_pagamentos")
        .select("valor_total, data_prevista")
        .eq("autor_id", autorId)
        .eq("status", "pendente")
        .order("data_prevista")
        .limit(1);

      const proximoPagamento = pagamentosPendentes?.[0] || null;

      return {
        livrosCount: livrosCount || 0,
        totalGanhos,
        vendasMes,
        proximoPagamento,
      };
    },
    enabled: !!autorId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meu Dashboard</h1>
        <p className="text-muted-foreground">
          Acompanhe suas vendas e royalties
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meus Livros</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.livrosCount || 0}</div>
            <p className="text-xs text-muted-foreground">Livros ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ganhos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.totalGanhos || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Em royalties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.vendasMes || 0}</div>
            <p className="text-xs text-muted-foreground">Unidades vendidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximo Pagamento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.proximoPagamento
                ? formatCurrency(stats.proximoPagamento.valor_total)
                : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.proximoPagamento
                ? new Date(stats.proximoPagamento.data_prevista).toLocaleDateString("pt-BR")
                : "Nenhum pendente"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
            <CardDescription>Últimas vendas dos seus livros</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Nenhuma venda recente.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Ganhos</CardTitle>
            <CardDescription>Evolução dos seus royalties</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Gráfico em desenvolvimento.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
