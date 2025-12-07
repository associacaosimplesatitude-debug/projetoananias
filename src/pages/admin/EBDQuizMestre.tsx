import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Search, CheckCircle2, XCircle, Edit, HelpCircle } from "lucide-react";
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
}

interface Licao {
  id: string;
  titulo: string;
  numero_licao: number | null;
  revista_id: string | null;
  questoes_count: number;
}

export default function EBDQuizMestre() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRevista, setSelectedRevista] = useState<Revista | null>(null);
  const [selectedLicao, setSelectedLicao] = useState<Licao | null>(null);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);

  // Buscar todas as revistas
  const { data: revistas, isLoading: loadingRevistas } = useQuery({
    queryKey: ['ebd-revistas-quiz-mestre'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_revistas')
        .select('id, titulo, faixa_etaria_alvo, imagem_url, num_licoes, possui_quiz_mestre')
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

  // Filtrar revistas por busca
  const filteredRevistas = useMemo(() => {
    if (!revistas) return [];
    if (!searchTerm) return revistas;
    
    const search = searchTerm.toLowerCase();
    return revistas.filter(r => 
      r.titulo.toLowerCase().includes(search) ||
      r.faixa_etaria_alvo.toLowerCase().includes(search)
    );
  }, [revistas, searchTerm]);

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
            {/* Barra de pesquisa */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Pesquisar revista por título ou faixa etária..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

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
