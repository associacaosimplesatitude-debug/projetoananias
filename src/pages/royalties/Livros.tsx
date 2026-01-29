import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, BookOpen, Link2, Unlink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LivroDialog } from "@/components/royalties/LivroDialog";

export default function RoyaltiesLivros() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLivro, setSelectedLivro] = useState<any>(null);

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

  const handleEdit = (livro: any) => {
    setSelectedLivro(livro);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedLivro(null);
    setDialogOpen(true);
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
        <Button onClick={handleNew}>
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
                  <TableHead className="w-16">Capa</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Valor Capa</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {livros.map((livro: any) => (
                  <TableRow key={livro.id}>
                    <TableCell>
                      {livro.capa_url ? (
                        <img 
                          src={livro.capa_url} 
                          alt={livro.titulo}
                          className="w-10 h-14 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{livro.titulo}</TableCell>
                    <TableCell>{livro.royalties_autores?.nome_completo || "-"}</TableCell>
                    <TableCell>{formatCurrency(livro.valor_capa)}</TableCell>
                    <TableCell>
                      {livro.royalties_comissoes?.percentual 
                        ? `${livro.royalties_comissoes.percentual}%` 
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={livro.is_active ? "default" : "secondary"}>
                          {livro.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                        {livro.bling_produto_id ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <Link2 className="h-3 w-3 mr-1" />
                            Bling
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            <Unlink className="h-3 w-3 mr-1" />
                            Sem vínculo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(livro)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LivroDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        livro={selectedLivro}
      />
    </div>
  );
}
