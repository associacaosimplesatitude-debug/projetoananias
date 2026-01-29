import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, TrendingUp, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoyaltiesAuth } from "@/hooks/useRoyaltiesAuth";

export default function AutorMeusLivros() {
  const { autorId } = useRoyaltiesAuth();

  const { data: livros = [], isLoading } = useQuery({
    queryKey: ["autor-livros", autorId],
    queryFn: async () => {
      if (!autorId) return [];

      const { data, error } = await supabase
        .from("royalties_livros")
        .select(`
          *,
          royalties_comissoes (percentual, periodo_pagamento)
        `)
        .eq("autor_id", autorId)
        .order("titulo");

      if (error) throw error;
      return data || [];
    },
    enabled: !!autorId,
  });

  // Fetch sales stats for each book
  const { data: salesStats = {} } = useQuery({
    queryKey: ["autor-livros-stats", autorId],
    queryFn: async () => {
      if (!autorId) return {};

      const livroIds = livros.map((l: any) => l.id);
      if (livroIds.length === 0) return {};

      const { data, error } = await supabase
        .from("royalties_vendas")
        .select("livro_id, quantidade, valor_comissao_total")
        .in("livro_id", livroIds);

      if (error) throw error;

      // Aggregate by book
      const stats: Record<string, { totalQtd: number; totalComissao: number }> = {};
      (data || []).forEach((v: any) => {
        if (!stats[v.livro_id]) {
          stats[v.livro_id] = { totalQtd: 0, totalComissao: 0 };
        }
        stats[v.livro_id].totalQtd += v.quantidade;
        stats[v.livro_id].totalComissao += Number(v.valor_comissao_total || 0);
      });

      return stats;
    },
    enabled: !!autorId && livros.length > 0,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getPeriodoLabel = (periodo: string) => {
    const map: Record<string, string> = {
      "1_mes": "Mensal",
      "3_meses": "Trimestral",
      "6_meses": "Semestral",
      "12_meses": "Anual",
    };
    return map[periodo] || periodo;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const totalLivros = livros.length;
  const livrosAtivos = livros.filter((l: any) => l.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meus Livros</h1>
        <p className="text-muted-foreground">
          Visualize todos os seus livros cadastrados e suas estatísticas
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Livros</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLivros}</div>
            <p className="text-xs text-muted-foreground">
              {livrosAtivos} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(salesStats).reduce((acc: number, s: any) => acc + s.totalQtd, 0)} un.
            </div>
            <p className="text-xs text-muted-foreground">
              Todas as vendas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Comissões</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(Object.values(salesStats).reduce((acc: number, s: any) => acc + s.totalComissao, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Acumulado total
            </p>
          </CardContent>
        </Card>
      </div>

      {livros.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Você ainda não possui livros cadastrados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {livros.map((livro: any) => {
            const stats = salesStats[livro.id] || { totalQtd: 0, totalComissao: 0 };
            
            return (
              <Card key={livro.id} className="hover:shadow-md transition-shadow">
                {livro.imagem_capa_url && (
                  <div className="aspect-[3/4] w-full overflow-hidden rounded-t-lg">
                    <img
                      src={livro.imagem_capa_url}
                      alt={livro.titulo}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{livro.titulo}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {livro.descricao || "Sem descrição"}
                      </CardDescription>
                    </div>
                    <Badge variant={livro.is_active ? "default" : "secondary"}>
                      {livro.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Valor de Capa:</span>
                      <span className="font-medium">{formatCurrency(livro.valor_capa)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Comissão:</span>
                      <span className="font-medium">
                        {livro.royalties_comissoes?.percentual
                          ? `${livro.royalties_comissoes.percentual}%`
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Período:</span>
                      <span className="font-medium">
                        {livro.royalties_comissoes?.periodo_pagamento
                          ? getPeriodoLabel(livro.royalties_comissoes.periodo_pagamento)
                          : "-"}
                      </span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Vendas:</span>
                        <span className="font-medium">{stats.totalQtd} un.</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-muted-foreground">Comissão Acum.:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(stats.totalComissao)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
