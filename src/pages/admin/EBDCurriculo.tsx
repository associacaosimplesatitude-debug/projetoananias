import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Edit, Trash2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { RevistaDialog } from "@/components/ebd/RevistaDialog";
import { ImportXMLDialog } from "@/components/ebd/ImportXMLDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  sinopse: string | null;
  autor: string | null;
  imagem_url: string | null;
  num_licoes: number;
  preco_cheio: number;
}

export default function EBDCurriculo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRevista, setSelectedRevista] = useState<Revista | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [revistaToDelete, setRevistaToDelete] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: revistas, isLoading } = useQuery({
    queryKey: ['ebd-revistas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Revista[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ebd_revistas')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-revistas'] });
      toast.success('Revista excluída com sucesso!');
      setDeleteDialogOpen(false);
      setRevistaToDelete(null);
    },
    onError: (error) => {
      toast.error('Erro ao excluir revista');
      console.error(error);
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      // Deletar todas as lições globais primeiro
      const { error: licoesError } = await supabase
        .from('ebd_licoes')
        .delete()
        .is('church_id', null);
      
      if (licoesError) throw licoesError;

      // Depois deletar todas as revistas
      const { error: revistasError } = await supabase
        .from('ebd_revistas')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta todos
      
      if (revistasError) throw revistasError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-revistas'] });
      toast.success('Todas as revistas e lições foram excluídas!');
      setDeleteAllDialogOpen(false);
    },
    onError: (error) => {
      console.error('Erro ao excluir todas as revistas:', error);
      toast.error('Erro ao excluir as revistas');
    }
  });

  const handleEdit = (revista: Revista) => {
    setSelectedRevista(revista);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setRevistaToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedRevista(null);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Currículo EBD</h1>
            <p className="text-muted-foreground">Cadastre revistas e suas lições</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setDeleteAllDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar Tudo
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={async () => {
                try {
                  const response = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-xml-curriculo`,
                    {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                      }
                    }
                  );
                  const data = await response.json();
                  if (data.success) {
                    toast.success(`${data.message}`);
                    queryClient.invalidateQueries({ queryKey: ['ebd-revistas'] });
                  } else {
                    toast.error(data.error || 'Erro ao importar');
                  }
                } catch (error) {
                  console.error('Error calling import function:', error);
                  toast.error('Erro ao chamar função de importação');
                }
              }}
            >
              <FileUp className="w-4 h-4 mr-2" />
              Importar XML do Servidor
            </Button>
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <FileUp className="w-4 h-4 mr-2" />
              Importar XML Manual
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Revista
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </CardContent>
          </Card>
        ) : !revistas || revistas.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma revista cadastrada</p>
              <p className="text-sm">Comece criando uma revista e suas lições</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {revistas.map((revista) => (
              <Card key={revista.id} className="overflow-hidden">
                {revista.imagem_url && (
                  <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                    <img
                      src={revista.imagem_url}
                      alt={revista.titulo}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{revista.titulo}</CardTitle>
                  <CardDescription>
                    {revista.faixa_etaria_alvo} • {revista.num_licoes} lições
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {revista.autor && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Autor: {revista.autor}
                    </p>
                  )}
                  {revista.sinopse && (
                    <p className="text-sm line-clamp-3 mb-4">{revista.sinopse}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(revista)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(revista.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <RevistaDialog
          open={dialogOpen}
          onOpenChange={handleCloseDialog}
          revista={selectedRevista}
        />

        <ImportXMLDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['ebd-revistas'] })}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta revista? Esta ação não pode ser desfeita e
                todas as lições associadas também serão excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => revistaToDelete && deleteMutation.mutate(revistaToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>⚠️ Atenção: Exclusão Total</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p className="font-semibold text-destructive">
                  Esta ação irá excluir TODAS as revistas e lições importadas do banco de dados!
                </p>
                <p>
                  Use esta função apenas para testes ou quando precisar limpar completamente o catálogo.
                </p>
                <p className="text-sm text-muted-foreground">
                  Esta ação não pode ser desfeita.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAllMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sim, excluir tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
