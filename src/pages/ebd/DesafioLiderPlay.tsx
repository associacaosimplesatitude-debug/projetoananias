import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Clock, Trophy, Lock, Key, AlertTriangle, CheckCircle2 } from 'lucide-react';

type DesafioStatus = 'CONFIGURANDO' | 'PRONTO' | 'EM_ANDAMENTO' | 'FINALIZADO';

interface Desafio {
  id: string;
  nome: string;
  tempo_limite_minutos: number;
  status: DesafioStatus;
  iniciado_em: string | null;
}

interface Equipe {
  id: string;
  nome: 'EQUIPE_A' | 'EQUIPE_B';
  lider_id: string;
  pontuacao: number;
}

interface Pergunta {
  id: string;
  tipo: 'DESBLOQUEIO' | 'CHARADA';
  texto_pergunta: string;
  resposta_correta: string;
  ordem: number;
  equipe_alvo: 'EQUIPE_A' | 'EQUIPE_B';
}

export default function DesafioLiderPlay() {
  const { desafioId } = useParams<{ desafioId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Game state
  const [currentPerguntaIndex, setCurrentPerguntaIndex] = useState(0);
  const [resposta, setResposta] = useState('');
  const [erroCount, setErroCount] = useState(0);
  const [isPunished, setIsPunished] = useState(false);
  const [punishmentTimeLeft, setPunishmentTimeLeft] = useState(0);
  const [gameTimeLeft, setGameTimeLeft] = useState(0);
  const [charadaDigits, setCharadaDigits] = useState<string[]>(['', '', '', '']);
  const [charadaValidated, setCharadaValidated] = useState<boolean[]>([false, false, false, false]);
  const [currentDigitIndex, setCurrentDigitIndex] = useState(0);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Fetch professor ID for current user
  const { data: professor } = useQuery({
    queryKey: ['professor-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('ebd_professores')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch desafio
  const { data: desafio, isLoading: loadingDesafio } = useQuery({
    queryKey: ['desafio-play', desafioId],
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
    refetchInterval: 5000, // Check for status updates
  });

  // Fetch equipe where user is lider
  const { data: minhaEquipe } = useQuery({
    queryKey: ['minha-equipe', desafioId, professor?.id],
    queryFn: async () => {
      if (!professor?.id) return null;
      const { data, error } = await supabase
        .from('desafio_equipe')
        .select('*')
        .eq('desafio_id', desafioId)
        .eq('lider_id', professor.id)
        .single();
      
      if (error) return null;
      return data as Equipe;
    },
    enabled: !!desafioId && !!professor?.id,
  });

  // Fetch perguntas for my team
  const { data: perguntas } = useQuery({
    queryKey: ['perguntas-equipe', desafioId, minhaEquipe?.nome],
    queryFn: async () => {
      if (!minhaEquipe?.nome) return [];
      const { data, error } = await supabase
        .from('desafio_pergunta')
        .select('*')
        .eq('desafio_id', desafioId)
        .eq('equipe_alvo', minhaEquipe.nome)
        .order('ordem');
      
      if (error) throw error;
      return data as Pergunta[];
    },
    enabled: !!desafioId && !!minhaEquipe?.nome,
  });

  // Fetch answered questions to determine current position
  const { data: tentativas, refetch: refetchTentativas } = useQuery({
    queryKey: ['tentativas-equipe', desafioId, minhaEquipe?.id],
    queryFn: async () => {
      if (!minhaEquipe?.id) return [];
      const { data, error } = await supabase
        .from('desafio_tentativa_resposta')
        .select('*')
        .eq('desafio_id', desafioId)
        .eq('equipe_id', minhaEquipe.id)
        .eq('acertou', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!desafioId && !!minhaEquipe?.id,
  });

  // Initialize current pergunta based on answered questions
  useEffect(() => {
    if (tentativas && perguntas) {
      const answeredPerguntaIds = new Set(tentativas.map(t => t.pergunta_id));
      const nextIndex = perguntas.findIndex(p => !answeredPerguntaIds.has(p.id));
      setCurrentPerguntaIndex(nextIndex >= 0 ? nextIndex : perguntas.length);
    }
  }, [tentativas, perguntas]);

  // Game timer
  useEffect(() => {
    if (!desafio?.iniciado_em || desafio.status !== 'EM_ANDAMENTO') return;

    const startTime = new Date(desafio.iniciado_em).getTime();
    const endTime = startTime + desafio.tempo_limite_minutos * 60 * 1000;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setGameTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        toast.info('Tempo esgotado!');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [desafio]);

  // Punishment timer
  useEffect(() => {
    if (!isPunished) return;

    const interval = setInterval(() => {
      setPunishmentTimeLeft(prev => {
        if (prev <= 1000) {
          setIsPunished(false);
          setErroCount(0);
          toast.success('Punição encerrada! Você pode continuar.');
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPunished]);

  const currentPergunta = perguntas?.[currentPerguntaIndex];

  // Submit answer mutation
  const submitMutation = useMutation({
    mutationFn: async ({ perguntaId, respostaEnviada, acertou }: { perguntaId: string; respostaEnviada: string; acertou: boolean }) => {
      const { error } = await supabase
        .from('desafio_tentativa_resposta')
        .insert({
          desafio_id: desafioId,
          pergunta_id: perguntaId,
          equipe_id: minhaEquipe!.id,
          resposta_enviada: respostaEnviada,
          acertou,
          respondido_por: professor?.id,
        });
      
      if (error) throw error;
    },
  });

  const handleSubmitDesbloqueio = async () => {
    if (!currentPergunta || isPunished) return;

    const isCorrect = resposta === currentPergunta.resposta_correta;
    
    await submitMutation.mutateAsync({
      perguntaId: currentPergunta.id,
      respostaEnviada: resposta,
      acertou: isCorrect,
    });

    if (isCorrect) {
      toast.success('Resposta correta!');
      setResposta('');
      setErroCount(0);
      await refetchTentativas();
      setCurrentPerguntaIndex(prev => prev + 1);
    } else {
      const newErroCount = erroCount + 1;
      setErroCount(newErroCount);
      
      if (newErroCount >= 3) {
        setIsPunished(true);
        setPunishmentTimeLeft(60000); // 1 minute
        toast.error('3 erros! Punição de 1 minuto aplicada.');
      } else {
        toast.error(`Resposta incorreta! Tentativa ${newErroCount}/3`);
      }
      setResposta('');
    }
  };

  const handleCharadaDigitChange = async (index: number, value: string) => {
    if (!currentPergunta || value.length > 1) return;
    
    const digit = value.replace(/\D/g, '');
    const correctDigit = currentPergunta.resposta_correta[index];
    
    if (digit === correctDigit) {
      // Correct digit
      const newDigits = [...charadaDigits];
      newDigits[index] = digit;
      setCharadaDigits(newDigits);
      
      const newValidated = [...charadaValidated];
      newValidated[index] = true;
      setCharadaValidated(newValidated);
      
      // Check if all digits are correct
      if (index === 3 || newValidated.every((v, i) => v || i > index)) {
        const allCorrect = newValidated.filter((_, i) => i <= index).every(v => v) && index === 3;
        
        if (allCorrect || (index === 3 && digit === correctDigit)) {
          // All correct!
          await submitMutation.mutateAsync({
            perguntaId: currentPergunta.id,
            respostaEnviada: currentPergunta.resposta_correta,
            acertou: true,
          });
          
          toast.success('Charada completada!');
          setCharadaDigits(['', '', '', '']);
          setCharadaValidated([false, false, false, false]);
          setCurrentDigitIndex(0);
          await refetchTentativas();
          setCurrentPerguntaIndex(prev => prev + 1);
        } else {
          // Move to next digit
          setCurrentDigitIndex(index + 1);
          setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
        }
      }
    }
    // If incorrect, do nothing - user can try again
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Loading states
  if (loadingDesafio) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Desafio not found or not started
  if (!desafio) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Desafio não encontrado</h2>
            <Button onClick={() => navigate('/ebd/desafio-biblico')}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (desafio.status !== 'EM_ANDAMENTO') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {desafio.status === 'FINALIZADO' ? 'Desafio Finalizado' : 'Aguardando Início'}
            </h2>
            <p className="text-muted-foreground">
              {desafio.status === 'FINALIZADO' 
                ? 'Este desafio já foi encerrado.'
                : 'O superintendente ainda não iniciou este desafio.'}
            </p>
            <Button className="mt-4" onClick={() => navigate('/ebd/desafio-biblico')}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!minhaEquipe) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Você não é líder de nenhuma equipe neste desafio.
            </p>
            <Button className="mt-4" onClick={() => navigate('/ebd/desafio-biblico')}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Game completed - only show if we have questions AND completed them all
  if (perguntas && perguntas.length > 0 && currentPerguntaIndex >= perguntas.length) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-12 text-center">
            <Trophy className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <h2 className="text-2xl font-bold text-green-800 mb-2">Parabéns!</h2>
            <p className="text-green-700">
              Sua equipe completou todas as perguntas!
            </p>
            <p className="text-sm text-green-600 mt-2">
              Tempo restante: {formatTime(gameTimeLeft)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No questions available for this team
  if (!perguntas || perguntas.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sem perguntas disponíveis</h2>
            <p className="text-muted-foreground">
              Nenhuma pergunta foi cadastrada para sua equipe neste desafio.
            </p>
            <Button className="mt-4" onClick={() => navigate('/ebd/desafio-biblico')}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercent = perguntas ? (currentPerguntaIndex / perguntas.length) * 100 : 0;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            {desafio.nome}
          </h1>
          <Badge 
            variant={minhaEquipe.nome === 'EQUIPE_A' ? 'default' : 'destructive'}
            className="mt-1"
          >
            {minhaEquipe.nome === 'EQUIPE_A' ? 'Equipe A' : 'Equipe B'}
          </Badge>
        </div>
        
        {/* Timer */}
        <Card className={`p-4 ${gameTimeLeft < 60000 ? 'bg-red-50 border-red-300' : ''}`}>
          <div className="flex items-center gap-2">
            <Clock className={`h-5 w-5 ${gameTimeLeft < 60000 ? 'text-red-600 animate-pulse' : 'text-primary'}`} />
            <span className={`text-2xl font-mono font-bold ${gameTimeLeft < 60000 ? 'text-red-600' : ''}`}>
              {formatTime(gameTimeLeft)}
            </span>
          </div>
        </Card>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Progresso</span>
          <span>{currentPerguntaIndex}/{perguntas?.length || 0} perguntas</span>
        </div>
        <Progress value={progressPercent} />
      </div>

      {/* Punishment Overlay */}
      {isPunished && (
        <Card className="bg-red-100 border-red-300">
          <CardContent className="py-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-600 mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-red-800">PUNIÇÃO ATIVA</h3>
            <p className="text-red-700 mt-2">Aguarde o tempo de penalidade</p>
            <div className="text-4xl font-mono font-bold text-red-600 mt-4">
              {formatTime(punishmentTimeLeft)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Question */}
      {currentPergunta && !isPunished && (
        <Card className={currentPergunta.tipo === 'DESBLOQUEIO' ? 'border-yellow-300' : 'border-purple-300'}>
          <CardHeader>
            <div className="flex items-center gap-2">
              {currentPergunta.tipo === 'DESBLOQUEIO' ? (
                <Lock className="h-5 w-5 text-yellow-600" />
              ) : (
                <Key className="h-5 w-5 text-purple-600" />
              )}
              <CardTitle className="text-lg">
                Pergunta {currentPergunta.ordem} - {currentPergunta.tipo === 'DESBLOQUEIO' ? 'Desbloqueio' : 'Charada'}
              </CardTitle>
              {currentPergunta.tipo === 'DESBLOQUEIO' && erroCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {erroCount}/3 erros
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-lg leading-relaxed">{currentPergunta.texto_pergunta}</p>

            {/* Desbloqueio Input (2 digits) */}
            {currentPergunta.tipo === 'DESBLOQUEIO' && (
              <div className="flex flex-col items-center gap-4">
                <Input
                  value={resposta}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setResposta(value.slice(0, 2));
                  }}
                  placeholder="00"
                  maxLength={2}
                  className="w-24 text-center text-2xl font-mono"
                  disabled={isPunished || submitMutation.isPending}
                  autoFocus
                />
                <Button 
                  onClick={handleSubmitDesbloqueio}
                  disabled={resposta.length !== 2 || isPunished || submitMutation.isPending}
                  size="lg"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Responder
                </Button>
              </div>
            )}

            {/* Charada Input (4 digits with instant validation) */}
            {currentPergunta.tipo === 'CHARADA' && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Digite os 4 dígitos da charada. Cada dígito correto ficará verde.
                </p>
                <div className="flex gap-3">
                  {[0, 1, 2, 3].map((index) => (
                    <Input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      value={charadaDigits[index]}
                      onChange={(e) => handleCharadaDigitChange(index, e.target.value)}
                      maxLength={1}
                      className={`w-16 h-16 text-center text-3xl font-mono ${
                        charadaValidated[index] 
                          ? 'bg-green-100 border-green-500 text-green-700' 
                          : ''
                      }`}
                      disabled={charadaValidated[index] || submitMutation.isPending}
                      autoFocus={index === currentDigitIndex}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  {charadaValidated.map((valid, index) => (
                    <div key={index} className={`w-4 h-4 rounded-full ${valid ? 'bg-green-500' : 'bg-gray-300'}`} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
