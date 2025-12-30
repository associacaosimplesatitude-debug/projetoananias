import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Trophy, TrendingUp } from "lucide-react";

export default function ProfessorClasse() {
  const { user } = useAuth();

  const { data: professor } = useQuery({
    queryKey: ["professor-classe-info", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("ebd_professores")
        .select("id, nome_completo, turma_id")
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
    queryKey: ["professor-turma-ids", professor?.id],
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

  // Fetch alunos das turmas
  const { data: alunos, isLoading } = useQuery({
    queryKey: ["professor-alunos", turmaIds],
    queryFn: async () => {
      if (!turmaIds?.length) return [];

      const { data, error } = await supabase
        .from("ebd_alunos")
        .select(`
          *,
          turma:ebd_turmas(id, nome)
        `)
        .in("turma_id", turmaIds)
        .eq("is_active", true)
        .order("pontos_totais", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: turmaIds && turmaIds.length > 0,
  });

  // Fetch turmas info
  const { data: turmas } = useQuery({
    queryKey: ["professor-turmas-info", turmaIds],
    queryFn: async () => {
      if (!turmaIds?.length) return [];

      const { data, error } = await supabase
        .from("ebd_turmas")
        .select("*")
        .in("id", turmaIds)
        .eq("is_active", true);

      if (error) throw error;
      return data;
    },
    enabled: turmaIds && turmaIds.length > 0,
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const getNivelColor = (nivel: string) => {
    switch (nivel) {
      case "Safira":
        return "bg-blue-100 text-blue-800";
      case "Prata":
        return "bg-slate-100 text-slate-800";
      default:
        return "bg-amber-100 text-amber-800";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Minha Classe
        </h1>
        <p className="text-muted-foreground">
          Gerencie seus alunos e acompanhe o desempenho
        </p>
      </div>

      {/* Resumo das Turmas */}
      {turmas && turmas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {turmas.map((turma) => {
            const turmaAlunos = alunos?.filter(a => a.turma_id === turma.id) || [];
            const totalPontos = turmaAlunos.reduce((acc, a) => acc + (a.pontos_totais || 0), 0);
            const mediaPontos = turmaAlunos.length > 0 
              ? Math.round(totalPontos / turmaAlunos.length) 
              : 0;

            return (
              <Card key={turma.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{turma.nome}</CardTitle>
                  <CardDescription>{turma.faixa_etaria}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{turmaAlunos.length} alunos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{mediaPontos} pts média</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lista de Alunos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Alunos por Pontuação
          </CardTitle>
          <CardDescription>
            {alunos?.length || 0} aluno(s) matriculado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          ) : alunos && alunos.length > 0 ? (
            <div className="space-y-3">
              {alunos.map((aluno, index) => (
                <div
                  key={aluno.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      {index + 1}º
                    </span>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={aluno.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(aluno.nome_completo)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{aluno.nome_completo}</h3>
                      <p className="text-sm text-muted-foreground">
                        {aluno.turma?.nome}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getNivelColor(aluno.nivel)}>
                      {aluno.nivel}
                    </Badge>
                    <Badge variant="outline">{aluno.pontos_totais} pts</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum aluno matriculado nas suas turmas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
