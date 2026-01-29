import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AutorDialog } from "@/components/royalties/AutorDialog";

export default function RoyaltiesAutores() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAutor, setSelectedAutor] = useState<any>(null);

  const { data: autores = [], isLoading } = useQuery({
    queryKey: ["royalties-autores", search],
    queryFn: async () => {
      let query = supabase
        .from("royalties_autores")
        .select("*")
        .order("nome_completo");

      if (search) {
        query = query.or(`nome_completo.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const handleEdit = (autor: any) => {
    setSelectedAutor(autor);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedAutor(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Autores</h1>
          <p className="text-muted-foreground">
            Gerencie os autores cadastrados no sistema
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Autor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Autores</CardTitle>
          <CardDescription>
            {autores.length} autores encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
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
          ) : autores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum autor encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autores.map((autor) => (
                  <TableRow key={autor.id}>
                    <TableCell className="font-medium">{autor.nome_completo}</TableCell>
                    <TableCell>{autor.email}</TableCell>
                    <TableCell>{autor.cpf_cnpj || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={autor.is_active ? "default" : "secondary"}>
                        {autor.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(autor)}
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

      <AutorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        autor={selectedAutor}
      />
    </div>
  );
}
