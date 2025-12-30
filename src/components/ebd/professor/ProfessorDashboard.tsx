import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfWeek, endOfWeek, addWeeks, isSameWeek, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  AlertTriangle,
  Users,
  Trophy,
  Sparkles,
  ClipboardList,
  BookOpen,
  ArrowRight,
  Check,
  Gamepad2,
} from "lucide-react";
import { DesafioBiblicoCard } from "../DesafioBiblicoCard";

interface ProfessorDashboardProps {
  professor: {
    id: string;
    nome_completo: string;
    church_id: string;
    turma_id?: string | null;
  };
  turmas: Array<{
    id: string;
    nome: string;
    faixa_etaria: string;
  }>;
}

export function ProfessorDashboard({ professor, turmas }: ProfessorDashboardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = new Date();

  // Fetch próximas escalas do professor
  const { data: escalas } = useQuery({
    queryKey: ["professor-escalas", professor.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_escalas")
        .select(`
          *,
          turma:ebd_turmas(id, nome, faixa_etaria),
          professor:ebd_professores(nome_completo)
        `)
        .eq("professor_id", professor.id)
        .gte("data", format(today, "yyyy-MM-dd"))
        .order("data", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!professor.id,
  });

  // Fetch alunos das turmas do professor
  const { data: alunosStats } = useQuery({
    queryKey: ["professor-alunos-stats", turmas.map(t => t.id)],
    queryFn: async () => {
      if (!turmas.length) return { total: 0, mediaPresenca: 0, mediaPontos: 0 };

      const turmaIds = turmas.map(t => t.id);
      
      // Get total students
      const { data: alunos, error } = await supabase
        .from("ebd_alunos")
        .select("id, pontos_totais")
        .in("turma_id", turmaIds)
        .eq("is_active", true);

      if (error) throw error;

      const total = alunos?.length || 0;
      const mediaPontos = total > 0 
        ? Math.round((alunos?.reduce((acc, a) => acc + (a.pontos_totais || 0), 0) || 0) / total)
        : 0;

      // Get attendance from last 4 weeks
      const fourWeeksAgo = format(addWeeks(today, -4), "yyyy-MM-dd");
      const { data: frequencia } = await supabase
        .from("ebd_frequencia")
        .select("presente")
        .in("turma_id", turmaIds)
        .gte("data", fourWeeksAgo);

      const totalFreq = frequencia?.length || 0;
      const presentes = frequencia?.filter(f => f.presente).length || 0;
      const mediaPresenca = totalFreq > 0 ? Math.round((presentes / totalFreq) * 100) : 0;

      return { total, mediaPresenca, mediaPontos };
    },
    enabled: turmas.length > 0,
  });

  // Check for pending launches (last Sunday without data)
  const { data: lancamentosPendentes } = useQuery({
    queryKey: ["professor-lancamentos-pendentes", turmas.map(t => t.id)],
    queryFn: async () => {
      if (!turmas.length) return { hasPending: false, date: null };

      const turmaIds = turmas.map(t => t.id);
      
      // Find last Sunday
      const lastSunday = startOfWeek(today, { weekStartsOn: 0 });
      const lastSundayStr = format(lastSunday, "yyyy-MM-dd");

      // Check if there's dados_aula for last Sunday
      const { data: dadosAula, error } = await supabase
        .from("ebd_dados_aula")
        .select("id")
        .in("turma_id", turmaIds)
        .eq("data", lastSundayStr);

      if (error) {
        console.error("Error checking pending launches:", error);
        return { hasPending: false, date: null };
      }

      const hasPending = !dadosAula || dadosAula.length === 0;
      
      return { 
        hasPending, 
        date: hasPending ? lastSunday : null 
      };
    },
    enabled: turmas.length > 0,
  });

  // Check for active Bible Challenges where user is a leader
  const { data: desafioAtivo } = useQuery({
    queryKey: ["professor-desafio-ativo", professor.id],
    queryFn: async () => {
      if (!professor.id) return null;

      // Get equipes where professor is leader and challenge is EM_ANDAMENTO
      const { data: equipe, error } = await supabase
        .from("desafio_equipe")
        .select(`
          id,
          nome,
          desafio:desafio_biblico!inner(
            id,
            nome,
            status,
            tempo_limite_minutos,
            iniciado_em
          )
        `)
        .eq("lider_id", professor.id)
        .eq("desafio.status", "EM_ANDAMENTO")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking active challenge:", error);
        return null;
      }
      
      return equipe;
    },
    enabled: !!professor.id,
  });

  // Get próxima aula
  const proximaAula = escalas?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">
          Olá, {professor.nome_completo.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo(a) ao seu painel do professor
        </p>
      </div>

      {/* Card de Alerta: Desafio Bíblico Ativo */}
      {desafioAtivo && (
        <Card className="border-2 border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 animate-pulse-slow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Trophy className="h-6 w-6" />
              Desafio Bíblico em Andamento!
            </CardTitle>
            <CardDescription className="text-green-600 dark:text-green-300">
              Você é líder da equipe {desafioAtivo.nome === 'EQUIPE_A' ? 'A' : 'B'} no desafio "{(desafioAtivo.desafio as any)?.nome}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              size="lg"
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-lg"
              onClick={() => navigate(`/ebd/desafio-biblico/${(desafioAtivo.desafio as any)?.id}/jogar`)}
            >
              <Gamepad2 className="h-5 w-5" />
              Entrar no Desafio
              <ArrowRight className="h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Card de Destaque: Próxima Aula */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Minha Escala
          </CardTitle>
          <CardDescription>Próxima aula agendada</CardDescription>
        </CardHeader>
        <CardContent>
          {proximaAula ? (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-sm">
                      {format(parseISO(proximaAula.data), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </Badge>
                    {proximaAula.sem_aula && (
                      <Badge variant="destructive">Sem Aula</Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold">
                    Turma: {proximaAula.turma?.nome}
                  </h3>
                  <p className="text-muted-foreground">
                    Faixa etária: {proximaAula.turma?.faixa_etaria}
                  </p>
                  {proximaAula.observacao && (
                    <p className="text-sm text-muted-foreground">
                      Obs: {proximaAula.observacao}
                    </p>
                  )}
                </div>
                <Button 
                  onClick={() => navigate("/ebd/professor/aulas")}
                  className="gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Preparar Aula
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">
                Nenhuma aula agendada para as próximas semanas.
              </p>
              <Button 
                variant="outline" 
                className="mt-2"
                onClick={() => navigate("/ebd/professor/escala")}
              >
                Ver Escala Completa
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid de Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Card Desafio Bíblico */}
        {user && (
          <DesafioBiblicoCard
            churchId={professor.church_id}
            userId={user.id}
            userType="professor"
            turmaId={proximaAula?.turma?.id ?? turmas?.[0]?.id ?? professor.turma_id ?? null}
          />
        )}

        {/* Card de Alerta: Lançamentos Pendentes */}
        {lancamentosPendentes?.hasPending && (
          <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-5 w-5" />
                Lançamentos Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-4">
                Você ainda não realizou os lançamentos da última aula
                {lancamentosPendentes.date && (
                  <span className="font-medium">
                    {" "}({format(lancamentosPendentes.date, "dd/MM/yyyy")})
                  </span>
                )}
              </p>
              <Button 
                onClick={() => navigate("/ebd/professor/lancamentos")}
                variant="outline"
                className="gap-2 border-yellow-500 text-yellow-700 hover:bg-yellow-100"
              >
                <ClipboardList className="h-4 w-4" />
                Fazer Lançamentos
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Card: Status da Classe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Status da Classe
            </CardTitle>
            <CardDescription>
              {turmas.length} turma(s) vinculada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {alunosStats?.total || 0}
                </div>
                <p className="text-xs text-muted-foreground">Alunos</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {alunosStats?.mediaPresenca || 0}%
                </div>
                <p className="text-xs text-muted-foreground">Frequência</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {alunosStats?.mediaPontos || 0}
                </div>
                <p className="text-xs text-muted-foreground">Média Pts</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              className="w-full mt-4 gap-2"
              onClick={() => navigate("/ebd/professor/classe")}
            >
              Ver Detalhes
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Card: Ações de Gamificação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Gamificação
            </CardTitle>
            <CardDescription>Engaje seus alunos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => navigate("/ebd/professor/quizzes")}
            >
              <Sparkles className="h-4 w-4 text-purple-500" />
              Gerar Quiz com IA
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => navigate("/ebd/professor/lancamentos")}
            >
              <ClipboardList className="h-4 w-4 text-blue-500" />
              Lançar Pontuação Manual
            </Button>
          </CardContent>
        </Card>

        {/* Card: Próximas Aulas na Escala */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximas Aulas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {escalas && escalas.length > 0 ? (
              <div className="space-y-2">
                {escalas.slice(0, 4).map((escala) => (
                  <div 
                    key={escala.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {escala.sem_aula ? (
                        <Badge variant="secondary" className="text-xs">Sem Aula</Badge>
                      ) : (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      <span className="text-sm font-medium">
                        {format(parseISO(escala.data), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {escala.turma?.nome}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma aula agendada
              </p>
            )}
            <Button 
              variant="ghost" 
              className="w-full mt-2 gap-2"
              onClick={() => navigate("/ebd/professor/escala")}
            >
              Ver Escala Completa
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
