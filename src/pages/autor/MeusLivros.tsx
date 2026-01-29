import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meus Livros</h1>
        <p className="text-muted-foreground">
          Visualize todos os seus livros cadastrados
        </p>
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
          {livros.map((livro: any) => (
            <Card key={livro.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{livro.titulo}</CardTitle>
                    <CardDescription>{livro.descricao || "Sem descrição"}</CardDescription>
                  </div>
                  <Badge variant={livro.is_active ? "default" : "secondary"}>
                    {livro.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor de Capa:</span>
                    <span className="font-medium">{formatCurrency(livro.valor_capa)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comissão:</span>
                    <span className="font-medium">
                      {livro.royalties_comissoes?.percentual
                        ? `${livro.royalties_comissoes.percentual}%`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Por Unidade:</span>
                    <span className="font-medium text-primary">
                      {livro.royalties_comissoes?.percentual
                        ? formatCurrency(
                            (livro.valor_capa * livro.royalties_comissoes.percentual) / 100
                          )
                        : "-"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
