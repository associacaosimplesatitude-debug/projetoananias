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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Loader2, Users } from 'lucide-react';

interface Desafio {
  id: string;
  nome: string;
  tipo_publico: 'PROFESSORES' | 'ALUNOS';
}

interface Professor {
  id: string;
  nome_completo: string;
  avatar_url: string | null;
  email: string | null;
}

interface Equipe {
  id: string;
  nome: 'EQUIPE_A' | 'EQUIPE_B';
  lider_id: string | null;
}

interface MontarEquipesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desafio: Desafio;
  churchId: string;
}

export function MontarEquipesDialog({ open, onOpenChange, desafio, churchId }: MontarEquipesDialogProps) {
  const queryClient = useQueryClient();
  
  const [equipeA, setEquipeA] = useState<string[]>([]);
  const [equipeB, setEquipeB] = useState<string[]>([]);
  const [liderA, setLiderA] = useState<string>('');
  const [liderB, setLiderB] = useState<string>('');

  // Fetch professors
  const { data: professores, isLoading: loadingProfessores } = useQuery({
    queryKey: ['professores-desafio', churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_professores')
        .select('id, nome_completo, avatar_url, email')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('nome_completo');
      
      if (error) throw error;
      return data as Professor[];
    },
    enabled: open && !!churchId,
  });

  // Fetch existing equipes
  const { data: equipes, isLoading: loadingEquipes } = useQuery({
    queryKey: ['equipes-desafio', desafio.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('desafio_equipe')
        .select('id, nome, lider_id')
        .eq('desafio_id', desafio.id);
      
      if (error) throw error;
      return data as Equipe[];
    },
    enabled: open,
  });

  // Fetch existing membros
  const { data: membrosExistentes } = useQuery({
    queryKey: ['membros-equipes', desafio.id],
    queryFn: async () => {
      if (!equipes) return [];
      
      const equipeIds = equipes.map(e => e.id);
      const { data, error } = await supabase
        .from('desafio_membro_equipe')
        .select('equipe_id, professor_id')
        .in('equipe_id', equipeIds);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!equipes,
  });

  // Initialize state when data loads
  useEffect(() => {
    if (equipes && membrosExistentes) {
      const equipeAData = equipes.find(e => e.nome === 'EQUIPE_A');
      const equipeBData = equipes.find(e => e.nome === 'EQUIPE_B');
      
      if (equipeAData) {
        setLiderA(equipeAData.lider_id || '');
        setEquipeA(
          membrosExistentes
            .filter(m => m.equipe_id === equipeAData.id)
            .map(m => m.professor_id)
        );
      }
      
      if (equipeBData) {
        setLiderB(equipeBData.lider_id || '');
        setEquipeB(
          membrosExistentes
            .filter(m => m.equipe_id === equipeBData.id)
            .map(m => m.professor_id)
        );
      }
    }
  }, [equipes, membrosExistentes]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!equipes) throw new Error('Equipes não carregadas');
      
      const equipeAData = equipes.find(e => e.nome === 'EQUIPE_A');
      const equipeBData = equipes.find(e => e.nome === 'EQUIPE_B');
      
      if (!equipeAData || !equipeBData) throw new Error('Equipes não encontradas');

      // Update lideres
      await supabase
        .from('desafio_equipe')
        .update({ lider_id: liderA || null })
        .eq('id', equipeAData.id);
      
      await supabase
        .from('desafio_equipe')
        .update({ lider_id: liderB || null })
        .eq('id', equipeBData.id);

      // Delete existing members
      await supabase
        .from('desafio_membro_equipe')
        .delete()
        .in('equipe_id', [equipeAData.id, equipeBData.id]);

      // Insert new members for Equipe A
      if (equipeA.length > 0) {
        await supabase
          .from('desafio_membro_equipe')
          .insert(equipeA.map(profId => ({
            equipe_id: equipeAData.id,
            professor_id: profId,
          })));
      }

      // Insert new members for Equipe B
      if (equipeB.length > 0) {
        await supabase
          .from('desafio_membro_equipe')
          .insert(equipeB.map(profId => ({
            equipe_id: equipeBData.id,
            professor_id: profId,
          })));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipes-desafio'] });
      queryClient.invalidateQueries({ queryKey: ['membros-equipes'] });
      toast.success('Equipes salvas com sucesso!');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error saving equipes:', error);
      toast.error('Erro ao salvar equipes');
    },
  });

  const toggleProfessor = (profId: string, equipe: 'A' | 'B') => {
    if (equipe === 'A') {
      // Remove from B if exists
      setEquipeB(prev => prev.filter(id => id !== profId));
      if (liderB === profId) setLiderB('');
      
      // Toggle in A
      setEquipeA(prev => 
        prev.includes(profId) 
          ? prev.filter(id => id !== profId)
          : [...prev, profId]
      );
      if (equipeA.includes(profId) && liderA === profId) {
        setLiderA('');
      }
    } else {
      // Remove from A if exists
      setEquipeA(prev => prev.filter(id => id !== profId));
      if (liderA === profId) setLiderA('');
      
      // Toggle in B
      setEquipeB(prev => 
        prev.includes(profId) 
          ? prev.filter(id => id !== profId)
          : [...prev, profId]
      );
      if (equipeB.includes(profId) && liderB === profId) {
        setLiderB('');
      }
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const isLoading = loadingProfessores || loadingEquipes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Montar Equipes - {desafio.nome}
          </DialogTitle>
          <DialogDescription>
            Selecione os professores e defina os líderes de cada equipe
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Equipe A */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold text-blue-600">Equipe A</Label>
                <span className="text-sm text-muted-foreground">{equipeA.length} membros</span>
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                {professores?.map((prof) => {
                  const isInEquipeA = equipeA.includes(prof.id);
                  const isInEquipeB = equipeB.includes(prof.id);
                  
                  return (
                    <div
                      key={`a-${prof.id}`}
                      className={`flex items-center gap-2 p-2 rounded-md mb-1 ${
                        isInEquipeA ? 'bg-blue-50 border border-blue-200' : ''
                      } ${isInEquipeB ? 'opacity-40' : ''}`}
                    >
                      <Checkbox
                        checked={isInEquipeA}
                        onCheckedChange={() => toggleProfessor(prof.id, 'A')}
                        disabled={isInEquipeB}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={prof.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(prof.nome_completo)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">{prof.nome_completo}</span>
                    </div>
                  );
                })}
              </ScrollArea>
              
              {equipeA.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Líder da Equipe A</Label>
                  <RadioGroup value={liderA} onValueChange={setLiderA}>
                    {professores?.filter(p => equipeA.includes(p.id)).map(prof => (
                      <div key={`lider-a-${prof.id}`} className="flex items-center space-x-2">
                        <RadioGroupItem value={prof.id} id={`lider-a-${prof.id}`} />
                        <Label htmlFor={`lider-a-${prof.id}`} className="text-sm">
                          {prof.nome_completo}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </div>

            {/* Equipe B */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold text-red-600">Equipe B</Label>
                <span className="text-sm text-muted-foreground">{equipeB.length} membros</span>
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                {professores?.map((prof) => {
                  const isInEquipeA = equipeA.includes(prof.id);
                  const isInEquipeB = equipeB.includes(prof.id);
                  
                  return (
                    <div
                      key={`b-${prof.id}`}
                      className={`flex items-center gap-2 p-2 rounded-md mb-1 ${
                        isInEquipeB ? 'bg-red-50 border border-red-200' : ''
                      } ${isInEquipeA ? 'opacity-40' : ''}`}
                    >
                      <Checkbox
                        checked={isInEquipeB}
                        onCheckedChange={() => toggleProfessor(prof.id, 'B')}
                        disabled={isInEquipeA}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={prof.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(prof.nome_completo)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">{prof.nome_completo}</span>
                    </div>
                  );
                })}
              </ScrollArea>
              
              {equipeB.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Líder da Equipe B</Label>
                  <RadioGroup value={liderB} onValueChange={setLiderB}>
                    {professores?.filter(p => equipeB.includes(p.id)).map(prof => (
                      <div key={`lider-b-${prof.id}`} className="flex items-center space-x-2">
                        <RadioGroupItem value={prof.id} id={`lider-b-${prof.id}`} />
                        <Label htmlFor={`lider-b-${prof.id}`} className="text-sm">
                          {prof.nome_completo}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending || equipeA.length === 0 || equipeB.length === 0}
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Equipes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
