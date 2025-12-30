import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, TrendingUp, Download, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subWeeks } from "date-fns";

export default function ProfessorRelatorios() {
  const { user } = useAuth();

  const { data: professor } = useQuery({
    queryKey: ["professor-relatorios-info", user?.id],
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
    queryKey: ["professor-relatorios-turma-ids", professor?.id],
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

  // Fetch frequência data
  const { data: frequenciaData, isLoading } = useQuery({
    queryKey: ["professor-frequencia-chart", turmaIds],
    queryFn: async () => {
      if (!turmaIds?.length) return [];

      const eightWeeksAgo = format(subWeeks(new Date(), 8), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("ebd_frequencia")
        .select("data, presente")
        .in("turma_id", turmaIds)
        .gte("data", eightWeeksAgo)
        .order("data");

      if (error) throw error;

      // Group by week and calculate percentage
      const weeklyData = data?.reduce((acc, f) => {
        const week = format(new Date(f.data), "dd/MM");
        if (!acc[week]) {
          acc[week] = { total: 0, presentes: 0 };
        }
        acc[week].total++;
        if (f.presente) {
          acc[week].presentes++;
        }
        return acc;
      }, {} as Record<string, { total: number; presentes: number }>) || {};

      return Object.entries(weeklyData).map(([week, data]) => ({
        week,
        presenca: Math.round((data.presentes / data.total) * 100),
        total: data.total,
        presentes: data.presentes,
      }));
    },
    enabled: turmaIds && turmaIds.length > 0,
  });

  // Fetch pontuação data
  const { data: pontuacaoData } = useQuery({
    queryKey: ["professor-pontuacao-chart", turmaIds],
    queryFn: async () => {
      if (!turmaIds?.length) return [];

      const { data, error } = await supabase
        .from("ebd_alunos")
        .select("nome_completo, pontos_totais")
        .in("turma_id", turmaIds)
        .eq("is_active", true)
        .order("pontos_totais", { ascending: false })
        .limit(10);

      if (error) throw error;

      return data?.map(a => ({
        nome: a.nome_completo.split(" ")[0],
        pontos: a.pontos_totais,
      })) || [];
    },
    enabled: turmaIds && turmaIds.length > 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Relatórios
          </h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho da sua classe
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-muted rounded-lg" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      ) : (
        <>
          {/* Gráfico de Frequência */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Frequência Semanal
              </CardTitle>
              <CardDescription>
                Percentual de presença nas últimas 8 semanas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {frequenciaData && frequenciaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={frequenciaData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, 'Presença']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="presenca" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Dados de frequência não disponíveis.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico de Pontuação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top 10 Alunos por Pontuação
              </CardTitle>
              <CardDescription>
                Ranking dos alunos com mais pontos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pontuacaoData && pontuacaoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={pontuacaoData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="nome" type="category" width={80} />
                    <Tooltip />
                    <Bar 
                      dataKey="pontos" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Dados de pontuação não disponíveis.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo Estatístico */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Média de Frequência</CardDescription>
                <CardTitle className="text-3xl">
                  {frequenciaData && frequenciaData.length > 0
                    ? Math.round(frequenciaData.reduce((acc, d) => acc + d.presenca, 0) / frequenciaData.length)
                    : 0}%
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Maior Pontuação</CardDescription>
                <CardTitle className="text-3xl">
                  {pontuacaoData && pontuacaoData.length > 0
                    ? pontuacaoData[0].pontos
                    : 0} pts
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Média de Pontos</CardDescription>
                <CardTitle className="text-3xl">
                  {pontuacaoData && pontuacaoData.length > 0
                    ? Math.round(pontuacaoData.reduce((acc, d) => acc + d.pontos, 0) / pontuacaoData.length)
                    : 0} pts
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
