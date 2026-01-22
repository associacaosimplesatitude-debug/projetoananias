import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trophy, Star, Flame, BookOpen, Calendar, 
  HelpCircle, Heart, FileText, ChevronRight, Medal, User
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Json } from "@/integrations/supabase/types";
import { DesafioBiblicoCard } from "../DesafioBiblicoCard";
import { useAuth } from "@/hooks/useAuth";

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
  const { user } = useAuth();
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

  // Get today's reading from ebd_desafio_biblico_conteudo
  const { data: leituraDoDia } = useQuery({
    queryKey: ["leitura-do-dia", aluno.turma_id, aluno.church_id],
    queryFn: async () => {
      if (!aluno.turma_id) return null;

      const hoje = new Date();
      const hojeStr = format(hoje, "yyyy-MM-dd");
      const diaIndex = hoje.getDay(); // 0=domingo, 1=segunda, 2=terça...

      // Domingo não tem leitura no desafio
      if (diaIndex === 0) return null;

      // Buscar planejamento ativo para a turma
      const { data: planejamento, error: planejamentoError } = await supabase
        .from("ebd_planejamento")
        .select("id, revista_id, data_inicio")
        .eq("turma_id", aluno.turma_id)
        .lte("data_inicio", hojeStr)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planejamentoError || !planejamento) return null;

      // Buscar próxima aula para identificar a lição atual
      const { data: proximaEscala } = await supabase
        .from("ebd_escalas")
        .select("data, observacao")
        .eq("turma_id", aluno.turma_id)
        .eq("sem_aula", false)
        .gte("data", hojeStr)
        .order("data", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!proximaEscala) return null;

      // Extrair número da lição da observação
      const matchLicao = proximaEscala.observacao?.match(/Aula (\d+)/);
      const numeroLicao = matchLicao ? parseInt(matchLicao[1]) : null;

      if (!numeroLicao) return null;

      // Buscar conteúdo bíblico da lição
      const { data: conteudo, error: conteudoError } = await supabase
        .from("ebd_desafio_biblico_conteudo")
        .select("*")
        .eq("revista_id", planejamento.revista_id)
        .eq("licao_numero", numeroLicao)
        .maybeSingle();

      if (conteudoError || !conteudo) return null;

      // Mapear dia da semana para campo do conteúdo (seg=1, ter=2, qua=3, qui=4, sex=5, sab=6)
      const diaField = `dia${diaIndex}`;
      const livro = (conteudo as any)[`${diaField}_livro`];
      const versiculo = (conteudo as any)[`${diaField}_versiculo`];

      if (!livro || !versiculo) return null;

      return {
        licaoId: conteudo.id,
        titulo: `${livro} ${versiculo}`,
        licaoTitulo: `Lição ${numeroLicao}`,
        numeroLicao,
      };
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

  // Get pending quizzes with release time info
  const { data: quizPendente } = useQuery({
    queryKey: ["quiz-pendente", aluno.id, aluno.turma_id],
    queryFn: async () => {
      if (!aluno.turma_id) return null;

      const hoje = format(new Date(), "yyyy-MM-dd");

      const { data: quizzes, error: quizzesError } = await supabase
        .from("ebd_quizzes")
        .select("id, titulo, pontos_max, data_limite")
        .eq("turma_id", aluno.turma_id)
        .eq("is_active", true)
        .or(`data_limite.is.null,data_limite.gte.${hoje}`);

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
      const pendente = quizzes.find((q) => !respondidos.has(q.id));

      if (!pendente) return null;

      // Buscar hora_liberacao (campo novo)
      const { data: extraInfo } = await supabase
        .from("ebd_quizzes")
        .select("hora_liberacao, contexto, nivel")
        .eq("id", pendente.id)
        .single();

      return {
        ...pendente,
        hora_liberacao: (extraInfo as any)?.hora_liberacao || "09:00:00",
        contexto: (extraInfo as any)?.contexto || null,
        nivel: (extraInfo as any)?.nivel || null,
      };
    },
    enabled: !!aluno.turma_id,
  });

  // Get current week lesson from escala with magazine and professor info
  const { data: aulaDaSemana } = useQuery({
    queryKey: ["aula-da-semana", aluno.turma_id, aluno.church_id],
    queryFn: async () => {
      if (!aluno.turma_id) return null;

      const hoje = new Date();
      const hojeStr = format(hoje, "yyyy-MM-dd");

      // Buscar próxima aula da escala
      const { data: escala, error: escalaError } = await supabase
        .from("ebd_escalas")
        .select(`
          id, data, observacao, sem_aula,
          professor:ebd_professores!professor_id(id, nome_completo, avatar_url)
        `)
        .eq("turma_id", aluno.turma_id)
        .eq("sem_aula", false)
        .eq("tipo", "aula")
        .gte("data", hojeStr)
        .order("data", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (escalaError || !escala) return null;

      // Extrair número da lição da observação (ex: "Aula 4 - O Cativeiro...")
      const matchLicao = escala.observacao?.match(/Aula (\d+)/);
      const numeroLicao = matchLicao ? parseInt(matchLicao[1]) : null;
      const tituloLicao = escala.observacao?.replace(/^Aula \d+ - /, "") || "Lição";

      // Buscar planejamento para pegar revista
      const { data: planejamento } = await supabase
        .from("ebd_planejamento")
        .select("revista:ebd_revistas!ebd_planejamento_revista_id_fkey(id, titulo, imagem_url)")
        .eq("turma_id", aluno.turma_id)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: escala.id,
        data_aula: escala.data,
        titulo: tituloLicao,
        numero_licao: numeroLicao,
        professor: escala.professor || null,
        revista: planejamento?.revista || null,
      };
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
        {/* Card Desafio Bíblico */}
        {user && (
          <DesafioBiblicoCard
            churchId={aluno.church_id}
            userId={user.id}
            userType="aluno"
            turmaId={aluno.turma_id}
          />
        )}

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
        {quizPendente && (() => {
          // Calcular se quiz está liberado
          const agora = new Date();
          const hojeStr = format(agora, "yyyy-MM-dd");
          const dataQuiz = quizPendente.data_limite || hojeStr;
          const horaLib = quizPendente.hora_liberacao || "09:00:00";
          
          // Criar data/hora de liberação
          const [hora, minuto] = horaLib.split(":");
          const dataHoraLiberacao = new Date(`${dataQuiz}T${hora}:${minuto}:00`);
          const liberado = agora >= dataHoraLiberacao;
          
          // Calcular tempo restante
          const diffMs = dataHoraLiberacao.getTime() - agora.getTime();
          const diffMins = Math.max(0, Math.floor(diffMs / 60000));
          const horasRestantes = Math.floor(diffMins / 60);
          const minsRestantes = diffMins % 60;

          return (
            <Card className={`border-2 ${liberado ? "border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/20" : "border-gray-300 bg-gray-50/50 dark:bg-gray-950/20"}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HelpCircle className={`w-5 h-5 ${liberado ? "text-purple-500" : "text-gray-400"}`} />
                    Quiz da Aula
                  </CardTitle>
                  {quizPendente.nivel && (
                    <Badge variant="outline" className="text-xs">{quizPendente.nivel}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-medium mb-2">{quizPendente.titulo}</p>
                {quizPendente.contexto && (
                  <p className="text-xs text-muted-foreground mb-2">{quizPendente.contexto}</p>
                )}
                
                {liberado ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Ganhe até {quizPendente.pontos_max} pontos respondendo!
                    </p>
                    <Link to={`/ebd/aluno/quiz/${quizPendente.id}`}>
                      <Button className="w-full bg-purple-600 hover:bg-purple-700">
                        Responder Agora
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Libera em {format(dataHoraLiberacao, "dd/MM")} às {horaLib.slice(0, 5)}
                      </span>
                    </div>
                    {diffMins > 0 && diffMins <= 1440 && (
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">Faltam</p>
                        <p className="text-lg font-bold">
                          {horasRestantes > 0 ? `${horasRestantes}h ${minsRestantes}min` : `${minsRestantes} minutos`}
                        </p>
                      </div>
                    )}
                    <Button className="w-full mt-3" variant="outline" disabled>
                      Aguardando liberação
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}

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
                {/* Magazine info */}
                {aulaDaSemana.revista && (
                  <div className="flex items-center gap-2 mb-3">
                    {aulaDaSemana.revista.imagem_url && (
                      <img 
                        src={aulaDaSemana.revista.imagem_url} 
                        alt={aulaDaSemana.revista.titulo}
                        className="h-12 w-9 object-cover rounded shadow-sm"
                      />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {aulaDaSemana.revista.titulo}
                    </span>
                  </div>
                )}

                {aulaDaSemana.numero_licao && (
                  <Badge variant="outline" className="mb-2">
                    Lição {aulaDaSemana.numero_licao}
                  </Badge>
                )}
                <p className="font-medium mb-2">{aulaDaSemana.titulo}</p>
                <p className="text-sm text-muted-foreground mb-3">
                  {format(new Date(aulaDaSemana.data_aula), "EEEE, dd 'de' MMMM", {
                    locale: ptBR,
                  })}
                </p>

                {/* Professor info */}
                {aulaDaSemana.professor && (
                  <div className="flex items-center gap-2 mb-4 p-2 bg-background/50 rounded-lg">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={aulaDaSemana.professor.avatar_url || undefined} className="object-cover" />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs text-muted-foreground">Professor(a)</p>
                      <p className="text-sm font-medium">{aulaDaSemana.professor.nome_completo}</p>
                    </div>
                  </div>
                )}

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
