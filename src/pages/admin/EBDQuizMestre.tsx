import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, CheckCircle2, XCircle, Edit, HelpCircle, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QuizMestreDialog } from "@/components/ebd/QuizMestreDialog";

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  imagem_url: string | null;
  num_licoes: number;
  possui_quiz_mestre: boolean;
  categoria: string | null;
}

interface Licao {
  id: string;
  titulo: string;
  numero_licao: number | null;
  revista_id: string | null;
  questoes_count: number;
}

export default function EBDQuizMestre() {
  const [selectedRevista, setSelectedRevista] = useState<Revista | null>(null);
  const [selectedLicao, setSelectedLicao] = useState<Licao | null>(null);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState<string>("Revista EBD");
  const [filterSubcategoria, setFilterSubcategoria] = useState<string>("all");

  // Buscar todas as revistas
  const { data: revistas, isLoading: loadingRevistas } = useQuery({
    queryKey: ['ebd-revistas-quiz-mestre'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('id, titulo, faixa_etaria_alvo, imagem_url, num_licoes, possui_quiz_mestre, categoria')
        .order('titulo');

      if (error) throw error;
      return data as Revista[];
    },
  });

  // Buscar lições da revista selecionada
  const { data: licoes, isLoading: loadingLicoes, refetch: refetchLicoes } = useQuery({
    queryKey: ['ebd-licoes-revista', selectedRevista?.id],
    queryFn: async () => {
      if (!selectedRevista) return [];

      // Buscar lições com contagem de questões
      const { data: licoesData, error: licoesError } = await supabase
        .from('ebd_licoes')
        .select('id, titulo, numero_licao, revista_id')
        .eq('revista_id', selectedRevista.id)
        .order('numero_licao');

      if (licoesError) throw licoesError;

      // Para cada lição, buscar contagem de questões
      const licoesWithCount = await Promise.all(
        (licoesData || []).map(async (licao) => {
          const { count } = await supabase
            .from('ebd_quiz_mestre_questoes')
            .select('*', { count: 'exact', head: true })
            .eq('licao_id', licao.id);

          return {
            ...licao,
            questoes_count: count || 0
          };
        })
      );

      return licoesWithCount as Licao[];
    },
    enabled: !!selectedRevista,
  });

  // Extrair categorias e subcategorias únicas
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
      
      // Contar subcategorias que correspondem ao filtro de categoria atual
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

  // Filtrar revistas
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

  // Reset subcategoria quando categoria muda
  const handleCategoriaChange = (value: string) => {
    setFilterCategoria(value);
    setFilterSubcategoria("all");
  };

  const clearFilters = () => {
    setFilterCategoria("all");
    setFilterSubcategoria("all");
  };

  // Calcular progresso do quiz mestre
  const quizProgress = useMemo(() => {
    if (!licoes || licoes.length === 0) return 0;
    const licoesCompletas = licoes.filter(l => l.questoes_count === 10).length;
    return Math.round((licoesCompletas / licoes.length) * 100);
  }, [licoes]);

  const handleOpenQuizDialog = (licao: Licao) => {
    setSelectedLicao(licao);
    setQuizDialogOpen(true);
  };

  const handleCloseQuizDialog = () => {
    setQuizDialogOpen(false);
    setSelectedLicao(null);
    refetchLicoes();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Quiz Mestre</h1>
          <p className="text-muted-foreground">
            Cadastre as 10 perguntas do Quiz Mestre para cada lição das revistas
          </p>
        </div>

        {!selectedRevista ? (
          <>
            {/* Filtros */}
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
                          <SelectTrigger className="w-[250px]">
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

                    {/* Limpar Filtros */}
                    {(filterCategoria !== "all" || filterSubcategoria !== "all") && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="w-4 h-4 mr-1" />
                        Limpar
                      </Button>
                    )}

                    {/* Contagem de Resultados */}
                    <div className="text-sm text-muted-foreground">
                      {filteredRevistas.length} de {revistas.length} revista(s)
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de revistas */}
            {loadingRevistas ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </CardContent>
              </Card>
            ) : filteredRevistas.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma revista encontrada</p>
                  {(filterCategoria !== "all" || filterSubcategoria !== "all") && (
                    <Button variant="link" onClick={clearFilters}>Limpar filtros</Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRevistas.map((revista) => (
                  <Card 
                    key={revista.id} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelectedRevista(revista)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        {revista.imagem_url ? (
                          <img
                            src={revista.imagem_url}
                            alt={revista.titulo}
                            className="w-16 h-20 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-20 bg-muted rounded flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm line-clamp-2">{revista.titulo}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {revista.faixa_etaria_alvo}
                          </CardDescription>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge 
                              variant={revista.possui_quiz_mestre ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {revista.possui_quiz_mestre ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Quiz Completo
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Quiz Incompleto
                                </>
                              )}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <p className="text-xs text-muted-foreground">
                        {revista.num_licoes} lições
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Header com botão voltar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => setSelectedRevista(null)}>
                  ← Voltar
                </Button>
                <div>
                  <h2 className="text-xl font-semibold">{selectedRevista.titulo}</h2>
                  <p className="text-sm text-muted-foreground">{selectedRevista.faixa_etaria_alvo}</p>
                </div>
              </div>
              <Badge variant={selectedRevista.possui_quiz_mestre ? "default" : "secondary"}>
                {selectedRevista.possui_quiz_mestre ? "Quiz Mestre Completo" : "Quiz Mestre Incompleto"}
              </Badge>
            </div>

            {/* Progresso geral */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progresso do Quiz Mestre</span>
                  <span className="text-sm text-muted-foreground">{quizProgress}%</span>
                </div>
                <Progress value={quizProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {licoes?.filter(l => l.questoes_count === 10).length || 0} de {licoes?.length || 0} lições com quiz completo (10 perguntas cada)
                </p>
              </CardContent>
            </Card>

            {/* Lista de lições */}
            {loadingLicoes ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </CardContent>
              </Card>
            ) : !licoes || licoes.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground">
                  <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma lição cadastrada para esta revista</p>
                  <p className="text-sm mt-2">
                    Importe o XML da revista ou cadastre as lições manualmente na gestão de catálogo
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {licoes.map((licao) => (
                  <Card key={licao.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {licao.numero_licao || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{licao.titulo}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress 
                                value={(licao.questoes_count / 10) * 100} 
                                className="w-24 h-1.5" 
                              />
                              <span className="text-xs text-muted-foreground">
                                {licao.questoes_count}/10 perguntas
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant={licao.questoes_count === 10 ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleOpenQuizDialog(licao)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          {licao.questoes_count === 10 ? 'Editar Quiz' : 'Cadastrar Quiz'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Dialog para cadastrar/editar quiz */}
        {selectedLicao && (
          <QuizMestreDialog
            open={quizDialogOpen}
            onOpenChange={handleCloseQuizDialog}
            licaoId={selectedLicao.id}
            licaoTitulo={selectedLicao.titulo}
            licaoNumero={selectedLicao.numero_licao}
          />
        )}
      </div>
    </div>
  );
}
