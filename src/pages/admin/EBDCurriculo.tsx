import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Edit, Trash2, FileUp, Package, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RevistaDialog } from "@/components/ebd/RevistaDialog";
import { ImportXMLDialog } from "@/components/ebd/ImportXMLDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  estoque: number | null;
  categoria: string | null;
}

export default function EBDCurriculo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRevista, setSelectedRevista] = useState<Revista | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [revistaToDelete, setRevistaToDelete] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [filterSubcategoria, setFilterSubcategoria] = useState<string>("all");
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

  // Extract unique categories and subcategories
  const { categorias, subcategorias, categoriaCounts, subcategoriaCounts } = useMemo(() => {
    if (!revistas) return { categorias: [], subcategorias: [], categoriaCounts: {}, subcategoriaCounts: {} };
    
    const catSet = new Set<string>();
    const subSet = new Set<string>();
    const catCounts: Record<string, number> = {};
    const subCounts: Record<string, number> = {};
    
    revistas.forEach(r => {
      const cat = r.categoria || 'Sem Categoria';
      const sub = r.faixa_etaria_alvo || 'Sem Subcategoria';
      
      catSet.add(cat);
      catCounts[cat] = (catCounts[cat] || 0) + 1;
      
      // Only count subcategories that match current category filter
      if (filterCategoria === "all" || cat === filterCategoria) {
        subSet.add(sub);
        subCounts[sub] = (subCounts[sub] || 0) + 1;
      }
    });
    
    return {
      categorias: Array.from(catSet).sort(),
      subcategorias: Array.from(subSet).sort(),
      categoriaCounts: catCounts,
      subcategoriaCounts: subCounts
    };
  }, [revistas, filterCategoria]);

  // Filter revistas based on selected filters
  const filteredRevistas = useMemo(() => {
    if (!revistas) return [];
    
    return revistas.filter(r => {
      const cat = r.categoria || 'Sem Categoria';
      const sub = r.faixa_etaria_alvo || 'Sem Subcategoria';
      
      const matchCategoria = filterCategoria === "all" || cat === filterCategoria;
      const matchSubcategoria = filterSubcategoria === "all" || sub === filterSubcategoria;
      
      return matchCategoria && matchSubcategoria;
    });
  }, [revistas, filterCategoria, filterSubcategoria]);

  // Reset subcategoria filter when categoria changes
  const handleCategoriaChange = (value: string) => {
    setFilterCategoria(value);
    setFilterSubcategoria("all");
  };

  const clearFilters = () => {
    setFilterCategoria("all");
    setFilterSubcategoria("all");
  };

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
            <h1 className="text-3xl font-bold">Gestão de Catálogo EBD</h1>
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
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <FileUp className="w-4 h-4 mr-2" />
              Importar XML
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Revista
            </Button>
          </div>
        </div>

        {/* Filter Section */}
        {revistas && revistas.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filtros:</span>
                </div>
                
                <div className="flex flex-wrap gap-3 flex-1">
                  {/* Categoria Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Categoria</label>
                    <Select value={filterCategoria} onValueChange={handleCategoriaChange}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas ({revistas.length})</SelectItem>
                        {categorias.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat} ({categoriaCounts[cat] || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subcategoria Filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Subcategoria (Faixa Etária)</label>
                    <Select value={filterSubcategoria} onValueChange={setFilterSubcategoria}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Todas as subcategorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {subcategorias.map(sub => (
                          <SelectItem key={sub} value={sub}>
                            {sub} ({subcategoriaCounts[sub] || 0})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Clear Filters */}
                {(filterCategoria !== "all" || filterSubcategoria !== "all") && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-1" />
                    Limpar
                  </Button>
                )}

                {/* Results Count */}
                <div className="text-sm text-muted-foreground">
                  {filteredRevistas.length} de {revistas.length} produto(s)
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
        ) : filteredRevistas.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto encontrado com os filtros selecionados</p>
              <Button variant="link" onClick={clearFilters}>Limpar filtros</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRevistas.map((revista) => (
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
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{revista.titulo}</CardTitle>
                      <CardDescription>
                        {revista.faixa_etaria_alvo} • {revista.num_licoes} lições
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={revista.estoque && revista.estoque > 0 ? "default" : "destructive"}
                      className="flex items-center gap-1"
                    >
                      <Package className="w-3 h-3" />
                      {revista.estoque ?? 0}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {revista.categoria && (
                    <p className="text-xs text-muted-foreground mb-1">
                      Categoria: {revista.categoria}
                    </p>
                  )}
                  {revista.autor && (
                    <p className="text-xs text-muted-foreground mb-1">
                      Autor: {revista.autor}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground line-through">
                      R$ {(revista.preco_cheio || 0).toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-sm font-semibold text-green-600">
                      R$ {((revista.preco_cheio || 0) * 0.7).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  {revista.sinopse && (
                    <p className="text-xs line-clamp-3 mb-4 text-muted-foreground">{revista.sinopse}</p>
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
