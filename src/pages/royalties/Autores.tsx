import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, ExternalLink, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AutorDialog } from "@/components/royalties/AutorDialog";

export default function RoyaltiesAutores() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAutor, setSelectedAutor] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [autorToDelete, setAutorToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteClick = (autor: any) => {
    setAutorToDelete(autor);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!autorToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("royalties_autores")
        .delete()
        .eq("id", autorToDelete.id);

      if (error) throw error;

      toast.success("Autor excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["royalties-autores"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-livros"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-vendas"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-top-autores"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-top-livros"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-total-a-pagar"] });
    } catch (error: any) {
      toast.error("Erro ao excluir autor: " + error.message);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setAutorToDelete(null);
    }
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
                  <TableRow key={autor.id} className="group">
                    <TableCell>
                      <button
                        onClick={() => navigate(`/royalties/autores/${autor.id}`)}
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        {autor.nome_completo}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </TableCell>
                    <TableCell>{autor.email}</TableCell>
                    <TableCell>{autor.cpf_cnpj || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={autor.is_active ? "default" : "secondary"}>
                        {autor.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(autor)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(autor)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir autor?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                Você está prestes a excluir <strong>{autorToDelete?.nome_completo}</strong>.
              </span>
              <span className="block mt-2 text-destructive font-medium">
                Atenção: Todos os dados relacionados serão excluídos permanentemente, incluindo livros, vendas, comissões, pagamentos e contratos.
              </span>
              <span className="block mt-2">
                Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
