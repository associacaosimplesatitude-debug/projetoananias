import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, ShoppingCart, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088FE"];

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

  // Top autores query
  const { data: topAutores = [] } = useQuery({
    queryKey: ["royalties-top-autores"],
    queryFn: async () => {
      // Get all authors with their books
      const { data: autores } = await supabase
        .from("royalties_autores")
        .select(`
          id,
          nome_completo,
          royalties_livros (id)
        `)
        .eq("is_active", true);

      if (!autores?.length) return [];

      // Get all sales
      const { data: vendas } = await supabase
        .from("royalties_vendas")
        .select("livro_id, valor_comissao_total");

      if (!vendas?.length) return [];

      // Calculate totals per author
      const autorTotals = autores.map((autor) => {
        const livroIds = autor.royalties_livros?.map((l: any) => l.id) || [];
        const totalComissao = vendas
          .filter((v) => livroIds.includes(v.livro_id))
          .reduce((sum, v) => sum + Number(v.valor_comissao_total || 0), 0);
        
        return {
          nome: autor.nome_completo,
          total: totalComissao,
        };
      });

      return autorTotals
        .filter((a) => a.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
  });

  // Top livros query
  const { data: topLivros = [] } = useQuery({
    queryKey: ["royalties-top-livros"],
    queryFn: async () => {
      const { data: livros } = await supabase
        .from("royalties_livros")
        .select("id, titulo")
        .eq("is_active", true);

      if (!livros?.length) return [];

      const { data: vendas } = await supabase
        .from("royalties_vendas")
        .select("livro_id, quantidade");

      if (!vendas?.length) return [];

      const livroTotals = livros.map((livro) => {
        const totalQuantidade = vendas
          .filter((v) => v.livro_id === livro.id)
          .reduce((sum, v) => sum + (v.quantidade || 0), 0);
        
        return {
          titulo: livro.titulo,
          quantidade: totalQuantidade,
        };
      });

      return livroTotals
        .filter((l) => l.quantidade > 0)
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);
    },
  });

  // Monthly sales data for chart
  const { data: vendasMensal = [] } = useQuery({
    queryKey: ["royalties-vendas-mensal"],
    queryFn: async () => {
      const { data: vendas } = await supabase
        .from("royalties_vendas")
        .select("data_venda, quantidade, valor_comissao_total")
        .order("data_venda", { ascending: true });

      if (!vendas?.length) return [];

      // Group by month
      const monthlyData: Record<string, { mes: string; quantidade: number; comissao: number }> = {};
      
      vendas.forEach((venda) => {
        const date = new Date(venda.data_venda);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { mes: monthLabel, quantidade: 0, comissao: 0 };
        }
        monthlyData[monthKey].quantidade += venda.quantidade || 0;
        monthlyData[monthKey].comissao += Number(venda.valor_comissao_total || 0);
      });

      return Object.values(monthlyData).slice(-6);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const kpis = [
    {
      title: "Autores Ativos",
      value: autoresCount,
      icon: Users,
      description: "Total de autores cadastrados",
      trend: null,
    },
    {
      title: "Livros Cadastrados",
      value: livrosCount,
      icon: BookOpen,
      description: "Total de livros ativos",
      trend: null,
    },
    {
      title: "Vendas do Mês",
      value: vendasMes,
      icon: ShoppingCart,
      description: "Unidades vendidas este mês",
      trend: "up" as const,
    },
    {
      title: "Royalties a Pagar",
      value: formatCurrency(totalAPagar),
      icon: DollarSign,
      description: "Total pendente de pagamento",
      trend: totalAPagar > 0 ? "pending" as const : null,
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
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{kpi.value}</div>
                {kpi.trend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
                {kpi.trend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
              </div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Mês</CardTitle>
            <CardDescription>Evolução das vendas nos últimos meses</CardDescription>
          </CardHeader>
          <CardContent>
            {vendasMensal.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={vendasMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === "quantidade" ? value : formatCurrency(value),
                      name === "quantidade" ? "Unidades" : "Comissão"
                    ]}
                  />
                  <Bar dataKey="quantidade" fill="#8884d8" name="quantidade" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhum dado disponível ainda.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Livro</CardTitle>
            <CardDescription>Top 5 livros mais vendidos</CardDescription>
          </CardHeader>
          <CardContent>
            {topLivros.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={topLivros}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ titulo, percent }) => `${titulo.substring(0, 15)}${titulo.length > 15 ? '...' : ''} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="quantidade"
                  >
                    {topLivros.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                Nenhum dado disponível ainda.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Autores</CardTitle>
            <CardDescription>Autores com maiores ganhos em royalties</CardDescription>
          </CardHeader>
          <CardContent>
            {topAutores.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Autor</TableHead>
                    <TableHead className="text-right">Total Royalties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAutores.map((autor, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{autor.nome}</TableCell>
                      <TableCell className="text-right">{formatCurrency(autor.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">
                Nenhum dado disponível ainda.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Livros</CardTitle>
            <CardDescription>Livros mais vendidos</CardDescription>
          </CardHeader>
          <CardContent>
            {topLivros.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Livro</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLivros.map((livro, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{livro.titulo}</TableCell>
                      <TableCell className="text-right">{livro.quantidade}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">
                Nenhum dado disponível ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
