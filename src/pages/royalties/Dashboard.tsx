import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, ShoppingCart, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function RoyaltiesDashboard() {
  // KPIs queries
  const { data: autoresCount = 0 } = useQuery({
    queryKey: ["royalties-autores-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("royalties_autores")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      return count || 0;
    },
  });

  const { data: livrosCount = 0 } = useQuery({
    queryKey: ["royalties-livros-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("royalties_livros")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      return count || 0;
    },
  });

  const { data: vendasMes = 0 } = useQuery({
    queryKey: ["royalties-vendas-mes"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from("royalties_vendas")
        .select("quantidade")
        .gte("data_venda", startOfMonth.toISOString().split('T')[0]);
      
      return data?.reduce((acc, v) => acc + (v.quantidade || 0), 0) || 0;
    },
  });

  const { data: totalAPagar = 0 } = useQuery({
    queryKey: ["royalties-total-a-pagar"],
    queryFn: async () => {
      const { data } = await supabase
        .from("royalties_vendas")
        .select("valor_comissao_total")
        .is("pagamento_id", null);
      
      return data?.reduce((acc, v) => acc + Number(v.valor_comissao_total || 0), 0) || 0;
    },
  });

  const kpis = [
    {
      title: "Autores Ativos",
      value: autoresCount,
      icon: Users,
      description: "Total de autores cadastrados",
    },
    {
      title: "Livros Cadastrados",
      value: livrosCount,
      icon: BookOpen,
      description: "Total de livros ativos",
    },
    {
      title: "Vendas do Mês",
      value: vendasMes,
      icon: ShoppingCart,
      description: "Unidades vendidas este mês",
    },
    {
      title: "Royalties a Pagar",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(totalAPagar),
      icon: DollarSign,
      description: "Total pendente de pagamento",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard de Royalties</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema de gestão de royalties
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Autores</CardTitle>
            <CardDescription>Autores com maiores ganhos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Nenhum dado disponível ainda.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Livros</CardTitle>
            <CardDescription>Livros mais vendidos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Nenhum dado disponível ainda.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
