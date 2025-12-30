import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChurchData } from "@/hooks/useChurchData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BookMarked, Users, Trophy, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DesafioLeituraRelatorio() {
  const { churchId, loading: loadingChurch } = useChurchData();

  // Buscar turmas da igreja
  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas-relatorio", churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select("id, nome, faixa_etaria")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
    enabled: !!churchId,
  });

  // Buscar alunos com suas leituras
  const { data: alunosLeituras = [], isLoading: loadingAlunos } = useQuery({
    queryKey: ["alunos-leituras-relatorio", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      // Buscar alunos
      const { data: alunos, error: alunosError } = await supabase
        .from("ebd_alunos")
        .select("id, nome_completo, pontos_totais, turma_id, user_id")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("pontos_totais", { ascending: false });

      if (alunosError) throw alunosError;

      // Buscar todas as leituras do desafio
      const { data: leituras, error: leiturasError } = await supabase
        .from("ebd_desafio_leitura_registro")
        .select("user_id, dia_numero, pontos_ganhos")
        .eq("church_id", churchId);

      if (leiturasError) throw leiturasError;

      // Agrupar leituras por user_id
      const leiturasPorUser = leituras?.reduce((acc, l) => {
        if (!acc[l.user_id]) {
          acc[l.user_id] = { count: 0, pontos: 0 };
        }
        acc[l.user_id].count++;
        acc[l.user_id].pontos += l.pontos_ganhos;
        return acc;
      }, {} as Record<string, { count: number; pontos: number }>);

      return alunos?.map((aluno) => ({
        ...aluno,
        leiturasCompletas: leiturasPorUser?.[aluno.user_id || ""]?.count || 0,
        pontosDesafio: leiturasPorUser?.[aluno.user_id || ""]?.pontos || 0,
      })) || [];
    },
    enabled: !!churchId,
  });

  // Buscar professores com suas leituras
  const { data: professoresLeituras = [] } = useQuery({
    queryKey: ["professores-leituras-relatorio", churchId],
    queryFn: async () => {
      if (!churchId) return [];

      const { data: professores, error: profError } = await supabase
        .from("ebd_professores")
        .select("id, nome_completo, turma_id, user_id")
        .eq("church_id", churchId)
        .eq("is_active", true);

      if (profError) throw profError;

      const { data: leituras, error: leiturasError } = await supabase
        .from("ebd_desafio_leitura_registro")
        .select("user_id, dia_numero, pontos_ganhos")
        .eq("church_id", churchId)
        .eq("user_type", "professor");

      if (leiturasError) throw leiturasError;

      const leiturasPorUser = leituras?.reduce((acc, l) => {
        if (!acc[l.user_id]) {
          acc[l.user_id] = { count: 0, pontos: 0 };
        }
        acc[l.user_id].count++;
        acc[l.user_id].pontos += l.pontos_ganhos;
        return acc;
      }, {} as Record<string, { count: number; pontos: number }>);

      return professores?.map((prof) => ({
        ...prof,
        leiturasCompletas: leiturasPorUser?.[prof.user_id || ""]?.count || 0,
        pontosDesafio: leiturasPorUser?.[prof.user_id || ""]?.pontos || 0,
      })) || [];
    },
    enabled: !!churchId,
  });

  // Estatísticas gerais
  const stats = {
    totalAlunos: alunosLeituras.length,
    alunosLendo: alunosLeituras.filter((a) => a.leiturasCompletas > 0).length,
    totalLeituras: alunosLeituras.reduce((acc, a) => acc + a.leiturasCompletas, 0) +
      professoresLeituras.reduce((acc, p) => acc + p.leiturasCompletas, 0),
    mediaProgresso: alunosLeituras.length > 0
      ? Math.round(
          (alunosLeituras.reduce((acc, a) => acc + a.leiturasCompletas, 0) / (alunosLeituras.length * 6)) * 100
        )
      : 0,
  };

  // Top 10 ranking
  const top10 = [...alunosLeituras]
    .sort((a, b) => b.pontosDesafio - a.pontosDesafio)
    .slice(0, 10);

  if (loadingChurch || loadingAlunos) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookMarked className="h-6 w-6" />
          Relatório - Desafio Bíblico
        </h1>
        <p className="text-muted-foreground">
          Acompanhe o progresso das leituras diárias
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alunos Participando
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.alunosLendo}/{stats.totalAlunos}
            </div>
            <Progress
              value={(stats.alunosLendo / stats.totalAlunos) * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Leituras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLeituras}</div>
            <p className="text-xs text-muted-foreground">confirmadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Média de Progresso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mediaProgresso}%</div>
            <Progress value={stats.mediaProgresso} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Professores Participando
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {professoresLeituras.filter((p) => p.leiturasCompletas > 0).length}/
              {professoresLeituras.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ranking Top 10 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top 10 - Desafio Bíblico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Leituras</TableHead>
                  <TableHead className="text-right">Pontos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top10.map((aluno, idx) => (
                  <TableRow key={aluno.id}>
                    <TableCell>
                      {idx < 3 ? (
                        <Badge
                          variant={idx === 0 ? "default" : "secondary"}
                          className={
                            idx === 0
                              ? "bg-yellow-500"
                              : idx === 1
                              ? "bg-gray-400"
                              : "bg-amber-700"
                          }
                        >
                          {idx + 1}º
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{idx + 1}º</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{aluno.nome_completo}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{aluno.leiturasCompletas}/6</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {aluno.pontosDesafio}
                    </TableCell>
                  </TableRow>
                ))}
                {top10.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhuma leitura registrada ainda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Progresso por Turma */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Progresso por Turma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {turmas.map((turma) => {
              const alunosTurma = alunosLeituras.filter((a) => a.turma_id === turma.id);
              const totalLeiturasTurma = alunosTurma.reduce(
                (acc, a) => acc + a.leiturasCompletas,
                0
              );
              const maxLeituras = alunosTurma.length * 6;
              const progresso = maxLeituras > 0
                ? Math.round((totalLeiturasTurma / maxLeituras) * 100)
                : 0;

              return (
                <div key={turma.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{turma.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {alunosTurma.length} alunos • {totalLeiturasTurma} leituras
                      </p>
                    </div>
                    <Badge variant={progresso >= 50 ? "default" : "secondary"}>
                      {progresso}%
                    </Badge>
                  </div>
                  <Progress value={progresso} />
                </div>
              );
            })}
            {turmas.length === 0 && (
              <p className="text-center text-muted-foreground">
                Nenhuma turma cadastrada
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Detalhamento por Aluno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead className="text-center">Progresso</TableHead>
                <TableHead className="text-center">Leituras</TableHead>
                <TableHead className="text-right">Pontos Desafio</TableHead>
                <TableHead className="text-right">Pontos Totais</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alunosLeituras.map((aluno) => {
                const turma = turmas.find((t) => t.id === aluno.turma_id);
                const progresso = Math.round((aluno.leiturasCompletas / 6) * 100);

                return (
                  <TableRow key={aluno.id}>
                    <TableCell className="font-medium">{aluno.nome_completo}</TableCell>
                    <TableCell>{turma?.nome || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progresso} className="w-16" />
                        <span className="text-xs text-muted-foreground">{progresso}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{aluno.leiturasCompletas}/6</Badge>
                    </TableCell>
                    <TableCell className="text-right">{aluno.pontosDesafio}</TableCell>
                    <TableCell className="text-right font-bold">
                      {aluno.pontos_totais}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
