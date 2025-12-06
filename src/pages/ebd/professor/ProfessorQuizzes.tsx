import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfessorNavigation } from "@/components/ebd/professor/ProfessorNavigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, Sparkles, Plus, Users } from "lucide-react";

export default function ProfessorQuizzes() {
  const { user } = useAuth();

  const { data: professor } = useQuery({
    queryKey: ["professor-quizzes-info", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("ebd_professores")
        .select("id, nome_completo, turma_id, church_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch turmas vinculadas
  const { data: turmaIds } = useQuery({
    queryKey: ["professor-quizzes-turma-ids", professor?.id],
    queryFn: async () => {
      if (!professor?.id) return [];

      const { data: vinculados } = await supabase
        .from("ebd_professores_turmas")
        .select("turma_id")
        .eq("professor_id", professor.id);

      const ids = vinculados?.map(v => v.turma_id) || [];
      if (professor.turma_id && !ids.includes(professor.turma_id)) {
        ids.push(professor.turma_id);
      }
      return ids;
    },
    enabled: !!professor?.id,
  });

  // Fetch quizzes das turmas
  const { data: quizzes, isLoading } = useQuery({
    queryKey: ["professor-quizzes", turmaIds],
    queryFn: async () => {
      if (!turmaIds?.length) return [];

      const { data, error } = await supabase
        .from("ebd_quizzes")
        .select(`
          *,
          turma:ebd_turmas(id, nome),
          licao:ebd_licoes(id, titulo)
        `)
        .in("turma_id", turmaIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: turmaIds && turmaIds.length > 0,
  });

  // Fetch respostas dos quizzes
  const { data: respostas } = useQuery({
    queryKey: ["professor-quiz-respostas", quizzes?.map(q => q.id)],
    queryFn: async () => {
      if (!quizzes?.length) return {};

      const quizIds = quizzes.map(q => q.id);
      const { data, error } = await supabase
        .from("ebd_quiz_respostas")
        .select("quiz_id, completado")
        .in("quiz_id", quizIds);

      if (error) throw error;

      // Group by quiz_id
      return data?.reduce((acc, r) => {
        if (!acc[r.quiz_id]) {
          acc[r.quiz_id] = { total: 0, completados: 0 };
        }
        acc[r.quiz_id].total++;
        if (r.completado) {
          acc[r.quiz_id].completados++;
        }
        return acc;
      }, {} as Record<string, { total: number; completados: number }>) || {};
    },
    enabled: quizzes && quizzes.length > 0,
  });

  return (
    <>
      <ProfessorNavigation />
      <div className="container mx-auto py-6 px-4">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="h-6 w-6" />
                Quizzes e Avaliações
              </h1>
              <p className="text-muted-foreground">
                Crie quizzes e acompanhe os resultados
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Quiz
            </Button>
          </div>

          {/* Card Gerar Quiz com IA */}
          <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <Sparkles className="h-8 w-8 text-purple-600" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-semibold">Gerar Quiz com IA</h3>
                  <p className="text-muted-foreground">
                    Crie quizzes automaticamente baseados na lição da semana usando inteligência artificial
                  </p>
                </div>
                <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
                  <Sparkles className="h-4 w-4" />
                  Gerar com IA
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Quizzes */}
          <Card>
            <CardHeader>
              <CardTitle>Meus Quizzes</CardTitle>
              <CardDescription>
                {quizzes?.length || 0} quiz(zes) criado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-muted rounded-lg" />
                  ))}
                </div>
              ) : quizzes && quizzes.length > 0 ? (
                <div className="space-y-3">
                  {quizzes.map((quiz) => {
                    const stats = respostas?.[quiz.id] || { total: 0, completados: 0 };
                    return (
                      <div
                        key={quiz.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{quiz.titulo}</h3>
                            {quiz.is_active ? (
                              <Badge variant="default">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {quiz.turma?.nome}
                            {quiz.licao && ` • Lição: ${quiz.licao.titulo}`}
                          </p>
                          {quiz.data_limite && (
                            <p className="text-xs text-muted-foreground">
                              Limite: {format(parseISO(quiz.data_limite), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 sm:mt-0">
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{stats.completados}/{stats.total} respostas</span>
                          </div>
                          <Badge variant="outline">{quiz.pontos_max} pts</Badge>
                          <Button variant="outline" size="sm">
                            Ver Resultados
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhum quiz criado ainda.
                  </p>
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Primeiro Quiz
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
