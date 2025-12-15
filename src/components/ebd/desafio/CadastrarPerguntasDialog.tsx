import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, HelpCircle, Lock, Key } from 'lucide-react';

interface Desafio {
  id: string;
  nome: string;
  num_perguntas_desbloqueio: number;
  num_blocos_charada: number;
}

interface Pergunta {
  id?: string;
  desafio_id: string;
  tipo: 'DESBLOQUEIO' | 'CHARADA';
  texto_pergunta: string;
  resposta_correta: string;
  ordem: number;
  equipe_alvo: 'EQUIPE_A' | 'EQUIPE_B';
}

interface CadastrarPerguntasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desafio: Desafio;
}

export function CadastrarPerguntasDialog({ open, onOpenChange, desafio }: CadastrarPerguntasDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'EQUIPE_A' | 'EQUIPE_B'>('EQUIPE_A');
  const [perguntasA, setPerguntasA] = useState<Pergunta[]>([]);
  const [perguntasB, setPerguntasB] = useState<Pergunta[]>([]);

  // Calculate total questions needed
  const totalDesbloqueio = desafio.num_perguntas_desbloqueio;
  const totalCharada = desafio.num_blocos_charada * 4;
  const totalPerguntas = totalDesbloqueio + totalCharada;

  // Generate sequence: Desbloqueio -> Charada (4x) -> Desbloqueio -> Charada (4x) ...
  const generateSequence = (): Array<{ tipo: 'DESBLOQUEIO' | 'CHARADA'; blocoIndex: number }> => {
    const sequence: Array<{ tipo: 'DESBLOQUEIO' | 'CHARADA'; blocoIndex: number }> = [];
    let desbloqueioCount = 0;
    let blocoIndex = 0;
    
    while (sequence.length < totalPerguntas) {
      if (desbloqueioCount < totalDesbloqueio) {
        sequence.push({ tipo: 'DESBLOQUEIO', blocoIndex: desbloqueioCount });
        desbloqueioCount++;
      }
      
      if (blocoIndex < desafio.num_blocos_charada && sequence.length < totalPerguntas) {
        for (let i = 0; i < 4 && sequence.length < totalPerguntas; i++) {
          sequence.push({ tipo: 'CHARADA', blocoIndex });
        }
        blocoIndex++;
      }
    }
    
    return sequence;
  };

  const sequence = generateSequence();

  // Fetch existing questions
  const { data: existingPerguntas, isLoading } = useQuery({
    queryKey: ['perguntas-desafio', desafio.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('desafio_pergunta')
        .select('*')
        .eq('desafio_id', desafio.id)
        .order('ordem');
      
      if (error) throw error;
      return data as Pergunta[];
    },
    enabled: open,
  });

  // Initialize questions
  useEffect(() => {
    if (!open) return;
    
    const initPerguntas = (equipe: 'EQUIPE_A' | 'EQUIPE_B'): Pergunta[] => {
      const existing = existingPerguntas?.filter(p => p.equipe_alvo === equipe) || [];
      
      return sequence.map((item, index) => {
        const existingPergunta = existing.find(p => p.ordem === index + 1);
        return existingPergunta || {
          desafio_id: desafio.id,
          tipo: item.tipo,
          texto_pergunta: '',
          resposta_correta: '',
          ordem: index + 1,
          equipe_alvo: equipe,
        };
      });
    };

    setPerguntasA(initPerguntas('EQUIPE_A'));
    setPerguntasB(initPerguntas('EQUIPE_B'));
  }, [open, existingPerguntas, desafio.id, sequence.length]);

  const updatePergunta = (
    equipe: 'EQUIPE_A' | 'EQUIPE_B',
    index: number,
    field: 'texto_pergunta' | 'resposta_correta',
    value: string
  ) => {
    const setPerguntas = equipe === 'EQUIPE_A' ? setPerguntasA : setPerguntasB;
    setPerguntas(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validateResposta = (tipo: 'DESBLOQUEIO' | 'CHARADA', valor: string): boolean => {
    if (tipo === 'DESBLOQUEIO') {
      return /^\d{2}$/.test(valor);
    } else {
      return /^\d{4}$/.test(valor);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const allPerguntas = [...perguntasA, ...perguntasB].filter(p => p.texto_pergunta.trim());
      
      // Validate all filled questions
      for (const pergunta of allPerguntas) {
        if (!validateResposta(pergunta.tipo, pergunta.resposta_correta)) {
          throw new Error(
            `Resposta inválida para pergunta ${pergunta.ordem} (${pergunta.equipe_alvo}). ` +
            `Desbloqueio deve ter 2 dígitos, Charada deve ter 4 dígitos.`
          );
        }
      }

      // Delete existing questions
      await supabase
        .from('desafio_pergunta')
        .delete()
        .eq('desafio_id', desafio.id);

      // Insert new questions
      if (allPerguntas.length > 0) {
        const { error } = await supabase
          .from('desafio_pergunta')
          .insert(allPerguntas.map(({ id, ...p }) => p));
        
        if (error) throw error;
      }

      // Check if all questions are filled to update status
      const totalFilledA = perguntasA.filter(p => p.texto_pergunta.trim() && p.resposta_correta.trim()).length;
      const totalFilledB = perguntasB.filter(p => p.texto_pergunta.trim() && p.resposta_correta.trim()).length;
      
      if (totalFilledA === totalPerguntas && totalFilledB === totalPerguntas) {
        // Check if equipes have liders
        const { data: equipes } = await supabase
          .from('desafio_equipe')
          .select('lider_id')
          .eq('desafio_id', desafio.id);
        
        const hasLiders = equipes?.every(e => e.lider_id);
        
        if (hasLiders) {
          await supabase
            .from('desafio_biblico')
            .update({ status: 'PRONTO' })
            .eq('id', desafio.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perguntas-desafio'] });
      queryClient.invalidateQueries({ queryKey: ['desafios-biblicos'] });
      toast.success('Perguntas salvas com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const renderPerguntaForm = (pergunta: Pergunta, index: number, equipe: 'EQUIPE_A' | 'EQUIPE_B') => {
    const isDesbloqueio = pergunta.tipo === 'DESBLOQUEIO';
    
    return (
      <div 
        key={`${equipe}-${index}`} 
        className={`p-4 rounded-lg border ${isDesbloqueio ? 'bg-yellow-50 border-yellow-200' : 'bg-purple-50 border-purple-200'}`}
      >
        <div className="flex items-center gap-2 mb-3">
          {isDesbloqueio ? (
            <Lock className="h-4 w-4 text-yellow-600" />
          ) : (
            <Key className="h-4 w-4 text-purple-600" />
          )}
          <Badge variant={isDesbloqueio ? 'secondary' : 'default'}>
            {pergunta.ordem}. {isDesbloqueio ? 'Desbloqueio' : 'Charada'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            ({isDesbloqueio ? '2 dígitos' : '4 dígitos'})
          </span>
        </div>
        
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Pergunta</Label>
            <Textarea
              value={pergunta.texto_pergunta}
              onChange={(e) => updatePergunta(equipe, index, 'texto_pergunta', e.target.value)}
              placeholder="Digite a pergunta..."
              rows={2}
            />
          </div>
          <div>
            <Label className="text-sm">Resposta ({isDesbloqueio ? '2 dígitos' : '4 dígitos'})</Label>
            <Input
              value={pergunta.resposta_correta}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                const maxLength = isDesbloqueio ? 2 : 4;
                updatePergunta(equipe, index, 'resposta_correta', value.slice(0, maxLength));
              }}
              placeholder={isDesbloqueio ? '00' : '0000'}
              maxLength={isDesbloqueio ? 2 : 4}
              className="w-24 font-mono text-center"
            />
          </div>
        </div>
      </div>
    );
  };

  const perguntas = activeTab === 'EQUIPE_A' ? perguntasA : perguntasB;
  const filledCount = perguntas.filter(p => p.texto_pergunta.trim() && p.resposta_correta.trim()).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Cadastrar Perguntas - {desafio.nome}
          </DialogTitle>
          <DialogDescription>
            {totalDesbloqueio} perguntas de desbloqueio + {totalCharada} perguntas charada = {totalPerguntas} total por equipe
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'EQUIPE_A' | 'EQUIPE_B')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="EQUIPE_A" className="text-blue-600">
                Equipe A ({perguntasA.filter(p => p.texto_pergunta.trim()).length}/{totalPerguntas})
              </TabsTrigger>
              <TabsTrigger value="EQUIPE_B" className="text-red-600">
                Equipe B ({perguntasB.filter(p => p.texto_pergunta.trim()).length}/{totalPerguntas})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="EQUIPE_A">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {perguntasA.map((pergunta, index) => 
                    renderPerguntaForm(pergunta, index, 'EQUIPE_A')
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="EQUIPE_B">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {perguntasB.map((pergunta, index) => 
                    renderPerguntaForm(pergunta, index, 'EQUIPE_B')
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <div className="flex-1 text-sm text-muted-foreground">
            {filledCount}/{totalPerguntas} preenchidas
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Perguntas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
