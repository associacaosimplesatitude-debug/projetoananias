import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfessorNavigation } from "@/components/ebd/professor/ProfessorNavigation";
import { format, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Users, BookOpen, Trophy, ArrowRight } from "lucide-react";

export default function ProfessorLancamentos() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: professor } = useQuery({
    queryKey: ["professor-lancamentos-info", user?.id],
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
  const { data: turmas, isLoading } = useQuery({
    queryKey: ["professor-lancamentos-turmas", professor?.id],
    queryFn: async () => {
      if (!professor?.id) return [];

      const { data: vinculados } = await supabase
        .from("ebd_professores_turmas")
        .select("turma_id")
        .eq("professor_id", professor.id);

      const turmaIds = vinculados?.map(v => v.turma_id) || [];
      if (professor.turma_id && !turmaIds.includes(professor.turma_id)) {
        turmaIds.push(professor.turma_id);
      }

      if (turmaIds.length === 0) return [];

      const { data, error } = await supabase
        .from("ebd_turmas")
        .select("*")
        .in("id", turmaIds)
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
    enabled: !!professor?.id,
  });

  // Fetch últimos lançamentos
  const { data: ultimosLancamentos } = useQuery({
    queryKey: ["professor-ultimos-lancamentos", turmas?.map(t => t.id)],
    queryFn: async () => {
      if (!turmas?.length) return [];

      const turmaIds = turmas.map(t => t.id);
      const fourWeeksAgo = format(subWeeks(new Date(), 4), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("ebd_dados_aula")
        .select(`
          *,
          turma:ebd_turmas(id, nome)
        `)
        .in("turma_id", turmaIds)
        .gte("data", fourWeeksAgo)
        .order("data", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: turmas && turmas.length > 0,
  });

  const lancamentoOptions = [
    {
      title: "Chamada (Frequência)",
      description: "Registrar presença dos alunos",
      icon: Users,
      color: "text-blue-500",
      path: "/ebd/lancamento",
    },
    {
      title: "Dados da Aula",
      description: "Ofertas, visitantes, bíblias, revistas",
      icon: BookOpen,
      color: "text-green-500",
      path: "/ebd/lancamento",
    },
    {
      title: "Pontuação Manual",
      description: "Adicionar pontos por participação",
      icon: Trophy,
      color: "text-amber-500",
      path: "/ebd/lancamento",
    },
  ];

  return (
    <>
      <ProfessorNavigation />
      <div className="container mx-auto py-6 px-4">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Lançamentos
            </h1>
            <p className="text-muted-foreground">
              Registre chamadas, ofertas e pontuações
            </p>
          </div>

          {/* Opções de Lançamento */}
          <div className="grid gap-4 md:grid-cols-3">
            {lancamentoOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card 
                  key={option.title}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(option.path)}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className={`p-3 rounded-full bg-muted ${option.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold">{option.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                      <Button variant="outline" className="gap-2 w-full">
                        Acessar
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Turmas para Lançamento */}
          <Card>
            <CardHeader>
              <CardTitle>Minhas Turmas</CardTitle>
              <CardDescription>
                Selecione uma turma para fazer lançamentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-16 bg-muted rounded-lg" />
                  ))}
                </div>
              ) : turmas && turmas.length > 0 ? (
                <div className="space-y-3">
                  {turmas.map((turma) => (
                    <div
                      key={turma.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <h3 className="font-semibold">{turma.nome}</h3>
                        <p className="text-sm text-muted-foreground">
                          {turma.faixa_etaria}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/ebd/lancamento?turma=${turma.id}`)}
                      >
                        Lançar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma turma vinculada.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico de Lançamentos */}
          <Card>
            <CardHeader>
              <CardTitle>Últimos Lançamentos</CardTitle>
              <CardDescription>
                Histórico das últimas 4 semanas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ultimosLancamentos && ultimosLancamentos.length > 0 ? (
                <div className="space-y-3">
                  {ultimosLancamentos.map((lancamento) => (
                    <div
                      key={lancamento.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-background"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {format(new Date(lancamento.data), "dd/MM/yyyy")}
                          </Badge>
                          <span className="font-medium">{lancamento.turma?.nome}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          {lancamento.num_visitantes !== null && lancamento.num_visitantes > 0 && (
                            <span>{lancamento.num_visitantes} visitante(s)</span>
                          )}
                          {lancamento.valor_ofertas !== null && Number(lancamento.valor_ofertas) > 0 && (
                            <span>R$ {Number(lancamento.valor_ofertas).toFixed(2)}</span>
                          )}
                          {lancamento.num_biblias !== null && lancamento.num_biblias > 0 && (
                            <span>{lancamento.num_biblias} bíblia(s)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum lançamento registrado recentemente.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
