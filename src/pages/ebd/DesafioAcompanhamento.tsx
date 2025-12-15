import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Clock, Trophy, ArrowLeft, Users, Crown, Star, Medal } from 'lucide-react';
import confetti from 'canvas-confetti';

type DesafioStatus = 'CONFIGURANDO' | 'PRONTO' | 'EM_ANDAMENTO' | 'FINALIZADO';

interface Desafio {
  id: string;
  nome: string;
  tempo_limite_minutos: number;
  status: DesafioStatus;
  iniciado_em: string | null;
  finalizado_em: string | null;
}

interface Equipe {
  id: string;
  nome: 'EQUIPE_A' | 'EQUIPE_B';
  lider_id: string | null;
  pontuacao: number;
}

interface Professor {
  id: string;
  nome_completo: string;
  avatar_url: string | null;
}

export default function DesafioAcompanhamento() {
  const { desafioId } = useParams<{ desafioId: string }>();
  const navigate = useNavigate();
  
  const [gameTimeLeft, setGameTimeLeft] = useState(0);
  const [showVictory, setShowVictory] = useState(false);
  const [winner, setWinner] = useState<{ equipe: Equipe; professores: Professor[]; completionTime: number } | null>(null);
  const [isTie, setIsTie] = useState(false);

  // Fetch desafio with realtime
  const { data: desafio, isLoading: loadingDesafio } = useQuery({
    queryKey: ['desafio-acompanhamento', desafioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('desafio_biblico')
        .select('*')
        .eq('id', desafioId)
        .single();
      
      if (error) throw error;
      return data as Desafio;
    },
    enabled: !!desafioId,
    refetchInterval: 2000,
  });

  // Fetch equipes
  const { data: equipes } = useQuery({
    queryKey: ['equipes-acompanhamento', desafioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('desafio_equipe')
        .select('*')
        .eq('desafio_id', desafioId);
      
      if (error) throw error;
      return data as Equipe[];
    },
    enabled: !!desafioId,
  });

  // Fetch perguntas count per equipe
  const { data: perguntasCounts } = useQuery({
    queryKey: ['perguntas-counts', desafioId],
    queryFn: async () => {
      const { data: perguntasA } = await supabase
        .from('desafio_pergunta')
        .select('id')
        .eq('desafio_id', desafioId)
        .eq('equipe_alvo', 'EQUIPE_A');
      
      const { data: perguntasB } = await supabase
        .from('desafio_pergunta')
        .select('id')
        .eq('desafio_id', desafioId)
        .eq('equipe_alvo', 'EQUIPE_B');
      
      return {
        EQUIPE_A: perguntasA?.length || 0,
        EQUIPE_B: perguntasB?.length || 0,
      };
    },
    enabled: !!desafioId,
  });

  // Fetch tentativas corretas per equipe with realtime
  const { data: progressData, refetch: refetchProgress } = useQuery({
    queryKey: ['progress-acompanhamento', desafioId],
    queryFn: async () => {
      if (!equipes) return null;

      const equipeA = equipes.find(e => e.nome === 'EQUIPE_A');
      const equipeB = equipes.find(e => e.nome === 'EQUIPE_B');

      const [resA, resB] = await Promise.all([
        equipeA ? supabase
          .from('desafio_tentativa_resposta')
          .select('id, created_at')
          .eq('desafio_id', desafioId)
          .eq('equipe_id', equipeA.id)
          .eq('acertou', true)
          .order('created_at', { ascending: false })
          .limit(1) : Promise.resolve({ data: null }),
        equipeB ? supabase
          .from('desafio_tentativa_resposta')
          .select('id, created_at')
          .eq('desafio_id', desafioId)
          .eq('equipe_id', equipeB.id)
          .eq('acertou', true)
          .order('created_at', { ascending: false })
          .limit(1) : Promise.resolve({ data: null }),
      ]);

      const [countA, countB] = await Promise.all([
        equipeA ? supabase
          .from('desafio_tentativa_resposta')
          .select('id', { count: 'exact' })
          .eq('desafio_id', desafioId)
          .eq('equipe_id', equipeA.id)
          .eq('acertou', true) : Promise.resolve({ count: 0 }),
        equipeB ? supabase
          .from('desafio_tentativa_resposta')
          .select('id', { count: 'exact' })
          .eq('desafio_id', desafioId)
          .eq('equipe_id', equipeB.id)
          .eq('acertou', true) : Promise.resolve({ count: 0 }),
      ]);

      return {
        EQUIPE_A: { 
          correct: countA.count || 0,
          lastAnswerTime: resA.data?.[0]?.created_at 
        },
        EQUIPE_B: { 
          correct: countB.count || 0,
          lastAnswerTime: resB.data?.[0]?.created_at
        },
      };
    },
    enabled: !!desafioId && !!equipes,
    refetchInterval: 1000, // Realtime updates
  });

  // Fetch membros da equipe vencedora
  const fetchWinnerTeam = async (equipe: Equipe) => {
    const { data: membros } = await supabase
      .from('desafio_membro_equipe')
      .select('professor_id')
      .eq('equipe_id', equipe.id);
    
    if (!membros) return [];

    const professorIds = membros.map(m => m.professor_id);
    
    const { data: professores } = await supabase
      .from('ebd_professores')
      .select('id, nome_completo, avatar_url')
      .in('id', professorIds);
    
    return professores as Professor[] || [];
  };

  // Game timer
  useEffect(() => {
    if (!desafio?.iniciado_em || desafio.status !== 'EM_ANDAMENTO') return;

    const startTime = new Date(desafio.iniciado_em).getTime();
    const endTime = startTime + desafio.tempo_limite_minutos * 60 * 1000;

    const interval = setInterval(async () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setGameTimeLeft(remaining);

      if (remaining === 0 && desafio.status === 'EM_ANDAMENTO') {
        clearInterval(interval);
        // Tempo esgotado - determinar vencedor pelo progresso
        await handleTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [desafio]);

  // Realtime subscription for progress updates
  useEffect(() => {
    if (!desafioId) return;

    const channel = supabase
      .channel('desafio-progress')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'desafio_tentativa_resposta',
          filter: `desafio_id=eq.${desafioId}`,
        },
        () => {
          refetchProgress();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [desafioId, refetchProgress]);

  // Check for winner
  useEffect(() => {
    if (!progressData || !perguntasCounts || !equipes || showVictory) return;

    const equipeA = equipes.find(e => e.nome === 'EQUIPE_A');
    const equipeB = equipes.find(e => e.nome === 'EQUIPE_B');

    if (!equipeA || !equipeB) return;

    const progressA = progressData.EQUIPE_A.correct;
    const progressB = progressData.EQUIPE_B.correct;
    const totalA = perguntasCounts.EQUIPE_A;
    const totalB = perguntasCounts.EQUIPE_B;

    // Check if any team completed
    if (progressA === totalA && totalA > 0) {
      handleVictory(equipeA, progressData.EQUIPE_A.lastAnswerTime);
    } else if (progressB === totalB && totalB > 0) {
      handleVictory(equipeB, progressData.EQUIPE_B.lastAnswerTime);
    }
  }, [progressData, perguntasCounts, equipes, showVictory]);

  const handleVictory = async (equipe: Equipe, lastAnswerTime?: string) => {
    if (showVictory) return;

    setShowVictory(true);

    // Finalizar desafio
    await supabase
      .from('desafio_biblico')
      .update({ 
        status: 'FINALIZADO' as DesafioStatus,
        finalizado_em: new Date().toISOString()
      })
      .eq('id', desafioId);

    // Buscar professores da equipe vencedora
    const professores = await fetchWinnerTeam(equipe);

    // Calcular tempo de conclusão
    let completionTime = 0;
    if (desafio?.iniciado_em && lastAnswerTime) {
      const startTime = new Date(desafio.iniciado_em).getTime();
      const endTime = new Date(lastAnswerTime).getTime();
      completionTime = endTime - startTime;
    }

    setWinner({ equipe, professores, completionTime });
    
    // Confetti!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleTimeUp = async () => {
    if (!progressData || !perguntasCounts || !equipes) return;

    const equipeA = equipes.find(e => e.nome === 'EQUIPE_A');
    const equipeB = equipes.find(e => e.nome === 'EQUIPE_B');

    if (!equipeA || !equipeB) return;

    const progressA = progressData.EQUIPE_A.correct;
    const progressB = progressData.EQUIPE_B.correct;

    if (progressA === progressB) {
      // Empate
      setIsTie(true);
      setShowVictory(true);
      
      await supabase
        .from('desafio_biblico')
        .update({ 
          status: 'FINALIZADO' as DesafioStatus,
          finalizado_em: new Date().toISOString()
        })
        .eq('id', desafioId);
    } else {
      // Vencedor pelo progresso
      const winnerEquipe = progressA > progressB ? equipeA : equipeB;
      const winnerProgress = progressA > progressB ? progressData.EQUIPE_A : progressData.EQUIPE_B;
      await handleVictory(winnerEquipe, winnerProgress.lastAnswerTime);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercent = (equipeNome: 'EQUIPE_A' | 'EQUIPE_B') => {
    if (!progressData || !perguntasCounts) return 0;
    const correct = progressData[equipeNome]?.correct || 0;
    const total = perguntasCounts[equipeNome] || 1;
    return (correct / total) * 100;
  };

  const getProgressCount = (equipeNome: 'EQUIPE_A' | 'EQUIPE_B') => {
    if (!progressData || !perguntasCounts) return { correct: 0, total: 0 };
    return {
      correct: progressData[equipeNome]?.correct || 0,
      total: perguntasCounts[equipeNome] || 0,
    };
  };

  // Loading state
  if (loadingDesafio) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Victory Screen
  if (showVictory) {
    return (
      <div className="container mx-auto p-4 md:p-6 flex flex-col items-center justify-center min-h-[80vh]">
        {isTie ? (
          <Card className="w-full max-w-lg text-center border-yellow-300 bg-gradient-to-b from-yellow-50 to-background">
            <CardContent className="py-12">
              <Medal className="h-20 w-20 mx-auto text-yellow-500 mb-6" />
              <h1 className="text-3xl font-bold text-yellow-700 mb-4">EMPATE!</h1>
              <p className="text-muted-foreground text-lg">
                As duas equipes terminaram com o mesmo progresso.
              </p>
              <Button className="mt-8" onClick={() => navigate('/ebd/desafio-biblico')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar aos Desafios
              </Button>
            </CardContent>
          </Card>
        ) : winner ? (
          <Card className="w-full max-w-2xl text-center border-primary bg-gradient-to-b from-primary/10 to-background">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <Trophy className="h-24 w-24 text-yellow-500 animate-bounce" />
                  <Crown className="h-8 w-8 text-yellow-600 absolute -top-2 -right-2" />
                </div>
              </div>
              <CardTitle className="text-4xl font-bold text-primary">
                {winner.equipe.nome === 'EQUIPE_A' ? 'EQUIPE A' : 'EQUIPE B'} VENCEU!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center justify-center gap-2 text-lg text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span>Tempo de conclusão: <strong>{formatTime(winner.completionTime)}</strong></span>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center justify-center gap-2">
                  <Users className="h-5 w-5" />
                  Membros da Equipe Campeã
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {winner.professores.map((professor, index) => (
                    <div 
                      key={professor.id} 
                      className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50"
                    >
                      <div className="relative">
                        <Avatar className="h-16 w-16 border-2 border-primary">
                          <AvatarImage src={professor.avatar_url || undefined} />
                          <AvatarFallback className="text-lg">
                            {professor.nome_completo.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {index === 0 && (
                          <Star className="h-5 w-5 text-yellow-500 absolute -top-1 -right-1 fill-yellow-500" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-center line-clamp-2">
                        {professor.nome_completo}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button size="lg" onClick={() => navigate('/ebd/desafio-biblico')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar aos Desafios
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/ebd/desafio-biblico')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              {desafio?.nome}
            </h1>
            <p className="text-muted-foreground">Acompanhamento em Tempo Real</p>
          </div>
        </div>
        
        {/* Timer */}
        <Card className={`p-4 ${gameTimeLeft < 60000 ? 'bg-destructive/10 border-destructive' : ''}`}>
          <div className="flex items-center gap-2">
            <Clock className={`h-6 w-6 ${gameTimeLeft < 60000 ? 'text-destructive animate-pulse' : 'text-primary'}`} />
            <span className={`text-3xl font-mono font-bold ${gameTimeLeft < 60000 ? 'text-destructive' : ''}`}>
              {formatTime(gameTimeLeft)}
            </span>
          </div>
        </Card>
      </div>

      {/* Progress Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Equipe A */}
        <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Users className="h-6 w-6" />
              Equipe A
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-semibold">
                  {getProgressCount('EQUIPE_A').correct}/{getProgressCount('EQUIPE_A').total} perguntas
                </span>
              </div>
              <Progress 
                value={getProgressPercent('EQUIPE_A')} 
                className="h-4"
                indicatorClassName="bg-blue-500"
              />
              <div className="text-right text-2xl font-bold text-blue-600">
                {Math.round(getProgressPercent('EQUIPE_A'))}%
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipe B */}
        <Card className="border-2 border-red-300 bg-gradient-to-br from-red-50 to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <Users className="h-6 w-6" />
              Equipe B
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-semibold">
                  {getProgressCount('EQUIPE_B').correct}/{getProgressCount('EQUIPE_B').total} perguntas
                </span>
              </div>
              <Progress 
                value={getProgressPercent('EQUIPE_B')} 
                className="h-4"
                indicatorClassName="bg-red-500"
              />
              <div className="text-right text-2xl font-bold text-red-600">
                {Math.round(getProgressPercent('EQUIPE_B'))}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Badge */}
      <div className="flex justify-center">
        <Badge variant="default" className="text-lg px-6 py-2 animate-pulse">
          Desafio em andamento...
        </Badge>
      </div>
    </div>
  );
}
