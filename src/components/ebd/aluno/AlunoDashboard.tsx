import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, Star, Flame, BookOpen, Calendar, 
  HelpCircle, Heart, FileText, ChevronRight, Medal
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Json } from "@/integrations/supabase/types";

const NIVEIS = [
  { nome: "Bronze", pontos: 0, cor: "bg-amber-700" },
  { nome: "Prata", pontos: 501, cor: "bg-gray-400" },
  { nome: "Safira", pontos: 1001, cor: "bg-blue-500" },
];

interface AlunoDashboardProps {
  aluno: {
    id: string;
    nome_completo: string;
    pontos_totais: number;
    aulas_seguidas: number;
    nivel: string;
    turma_id: string | null;
    church_id: string;
    turma?: { id: string; nome: string; church_id: string } | null;
  };
}

export function AlunoDashboard({ aluno }: AlunoDashboardProps) {
  const nivelAtual = NIVEIS.find((n) => n.nome === aluno.nivel) || NIVEIS[0];
  const proximoNivel = NIVEIS.find((n) => n.pontos > aluno.pontos_totais);
  const progressoNivel = proximoNivel
    ? ((aluno.pontos_totais - nivelAtual.pontos) / (proximoNivel.pontos - nivelAtual.pontos)) * 100
    : 100;

  // Get student rank
  const { data: ranking } = useQuery({
    queryKey: ["aluno-rank", aluno.turma_id],
    queryFn: async () => {
      if (!aluno.turma_id) return null;
      const { data, error } = await supabase
        .from("ebd_alunos")
        .select("id, pontos_totais")
        .eq("turma_id", aluno.turma_id)
        .eq("is_active", true)
        .order("pontos_totais", { ascending: false });

      if (error) throw error;
      const position = data?.findIndex((a) => a.id === aluno.id) ?? -1;
      return { position: position + 1, total: data?.length || 0 };
    },
    enabled: !!aluno.turma_id,
  });

  // Get today's reading
  const { data: leituraDoDia } = useQuery({
    queryKey: ["leitura-do-dia", aluno.turma_id],
    queryFn: async () => {
      if (!aluno.turma_id) return null;

      const hoje = new Date();
      const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 });
      const diaIndex = hoje.getDay();

      // Find the current week's lesson
      const { data: licao, error } = await supabase
        .from("ebd_licoes")
        .select("id, titulo, plano_leitura_semanal, data_aula")
        .eq("turma_id", aluno.turma_id)
        .gte("data_aula", format(inicioSemana, "yyyy-MM-dd"))
        .lte("data_aula", format(addDays(inicioSemana, 6), "yyyy-MM-dd"))
        .order("data_aula", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (licao?.plano_leitura_semanal) {
        const plano = licao.plano_leitura_semanal as string[];
        if (Array.isArray(plano) && plano[diaIndex]) {
          return {
            licaoId: licao.id,
            titulo: plano[diaIndex],
            licaoTitulo: licao.titulo,
          };
        }
      }
      return null;
    },
    enabled: !!aluno.turma_id,
  });

  // Check if today's reading is done
  const { data: leituraFeita } = useQuery({
    queryKey: ["leitura-feita-hoje", aluno.id, leituraDoDia?.licaoId],
    queryFn: async () => {
      if (!leituraDoDia?.licaoId) return false;
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("ebd_leituras")
        .select("id")
        .eq("aluno_id", aluno.id)
        .eq("licao_id", leituraDoDia.licaoId)
        .eq("data_leitura", hoje)
        .eq("status", "completo")
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!leituraDoDia?.licaoId,
  });

  // Get pending quizzes
  const { data: quizPendente } = useQuery({
    queryKey: ["quiz-pendente", aluno.id, aluno.turma_id],
    queryFn: async () => {
      if (!aluno.turma_id) return null;

      const { data: quizzes, error: quizzesError } = await supabase
        .from("ebd_quizzes")
        .select("id, titulo, pontos_max")
        .eq("turma_id", aluno.turma_id)
        .eq("is_active", true)
        .or(`data_limite.is.null,data_limite.gte.${format(new Date(), "yyyy-MM-dd")}`);

      if (quizzesError) throw quizzesError;
      if (!quizzes?.length) return null;

      // Check which ones are completed
      const { data: respostas, error: respostasError } = await supabase
        .from("ebd_quiz_respostas")
        .select("quiz_id")
        .eq("aluno_id", aluno.id)
        .eq("completado", true);

      if (respostasError) throw respostasError;

      const respondidos = new Set(respostas?.map((r) => r.quiz_id) || []);
      return quizzes.find((q) => !respondidos.has(q.id)) || null;
    },
    enabled: !!aluno.turma_id,
  });

  // Get current week lesson
  const { data: aulaDaSemana } = useQuery({
    queryKey: ["aula-da-semana", aluno.turma_id],
    queryFn: async () => {
      if (!aluno.turma_id) return null;

      const hoje = new Date();
      const { data, error } = await supabase
        .from("ebd_licoes")
        .select("id, titulo, data_aula, numero_licao")
        .eq("turma_id", aluno.turma_id)
        .gte("data_aula", format(hoje, "yyyy-MM-dd"))
        .order("data_aula", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!aluno.turma_id,
  });

  return (
    <div className="space-y-6">
      {/* Status de Gamificação - Topo */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className={`w-16 h-16 rounded-full ${nivelAtual.cor} flex items-center justify-center shadow-lg`}>
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <Badge className="absolute -bottom-1 -right-1 bg-background border text-xs">
                  {aluno.nivel}
                </Badge>
              </div>
              <div>
                <h1 className="text-2xl font-bold">{aluno.nome_completo.split(" ")[0]}</h1>
                <p className="text-muted-foreground">{aluno.turma?.nome}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-background/80 rounded-lg px-4 py-2 shadow-sm">
                <Star className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Pontos</p>
                  <p className="font-bold text-lg">{aluno.pontos_totais}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-background/80 rounded-lg px-4 py-2 shadow-sm">
                <Flame className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Sequência</p>
                  <p className="font-bold text-lg">{aluno.aulas_seguidas}</p>
                </div>
              </div>
              {ranking && (
                <div className="flex items-center gap-2 bg-background/80 rounded-lg px-4 py-2 shadow-sm">
                  <Medal className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Rank</p>
                    <p className="font-bold text-lg">#{ranking.position}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {proximoNivel && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">
                  Próximo nível: {proximoNivel.nome}
                </span>
                <span className="font-medium">
                  {aluno.pontos_totais} / {proximoNivel.pontos} pts
                </span>
              </div>
              <Progress value={progressoNivel} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de Ação */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Leitura Diária */}
        <Card className={`border-2 ${leituraFeita ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "border-yellow-500/50"}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-yellow-500" />
                Sua Leitura de Hoje
              </CardTitle>
              {leituraFeita && (
                <Badge variant="default" className="bg-green-500">Concluída</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {leituraDoDia ? (
              <>
                <p className="text-sm text-muted-foreground mb-1">
                  {leituraDoDia.licaoTitulo}
                </p>
                <p className="font-medium mb-4">{leituraDoDia.titulo}</p>
                {!leituraFeita && (
                  <Link to="/ebd/aluno/leituras">
                    <Button className="w-full" variant="default">
                      <BookOpen className="w-4 h-4 mr-2" />
                      Ler e Pontuar +5
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum plano de leitura disponível para esta semana.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Quiz Pendente */}
        {quizPendente && (
          <Card className="border-2 border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-500" />
                Novo Quiz Disponível!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium mb-2">{quizPendente.titulo}</p>
              <p className="text-sm text-muted-foreground mb-4">
                Ganhe até {quizPendente.pontos_max} pontos respondendo!
              </p>
              <Button className="w-full" variant="default">
                Responder Agora
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Card 3: Aula da Semana */}
        <Card className="border-2 border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              Lição desta Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aulaDaSemana ? (
              <>
                {aulaDaSemana.numero_licao && (
                  <Badge variant="outline" className="mb-2">
                    Lição {aulaDaSemana.numero_licao}
                  </Badge>
                )}
                <p className="font-medium mb-2">{aulaDaSemana.titulo}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {format(new Date(aulaDaSemana.data_aula), "EEEE, dd 'de' MMMM", {
                    locale: ptBR,
                  })}
                </p>
                <Link to="/ebd/aluno/aulas">
                  <Button className="w-full" variant="outline">
                    Visualizar Aula
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma aula programada para esta semana.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acesso Rápido */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acesso Rápido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link to="/ebd/aluno/leituras">
              <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                <Calendar className="w-6 h-6 text-yellow-500" />
                <span className="text-xs">Leituras</span>
              </Button>
            </Link>
            <Link to="/ebd/aluno/aulas">
              <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                <Heart className="w-6 h-6 text-red-500" />
                <span className="text-xs">Devocionais</span>
              </Button>
            </Link>
            <Link to="/ebd/aluno/aulas">
              <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                <FileText className="w-6 h-6 text-blue-500" />
                <span className="text-xs">Materiais</span>
              </Button>
            </Link>
            <Link to="/ebd/aluno/turma">
              <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2">
                <Trophy className="w-6 h-6 text-primary" />
                <span className="text-xs">Ranking</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
