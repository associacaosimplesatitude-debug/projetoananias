import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function RoyaltiesLivros() {
  const [search, setSearch] = useState("");

  const { data: livros = [], isLoading } = useQuery({
    queryKey: ["royalties-livros", search],
    queryFn: async () => {
      let query = supabase
        .from("royalties_livros")
        .select(`
          *,
          royalties_autores (nome_completo),
          royalties_comissoes (percentual, periodo_pagamento)
        `)
        .order("titulo");

      if (search) {
        query = query.ilike("titulo", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Livros</h1>
          <p className="text-muted-foreground">
            Gerencie os livros e suas configurações de comissão
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Livro
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de Livros</CardTitle>
          <CardDescription>
            {livros.length} livros cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : livros.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum livro encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Valor Capa</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {livros.map((livro: any) => (
                  <TableRow key={livro.id}>
                    <TableCell className="font-medium">{livro.titulo}</TableCell>
                    <TableCell>{livro.royalties_autores?.nome_completo || "-"}</TableCell>
                    <TableCell>{formatCurrency(livro.valor_capa)}</TableCell>
                    <TableCell>
                      {livro.royalties_comissoes?.percentual 
                        ? `${livro.royalties_comissoes.percentual}%` 
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={livro.is_active ? "default" : "secondary"}>
                        {livro.is_active ? "Ativo" : "Inativo"}
                      </Badge>
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
