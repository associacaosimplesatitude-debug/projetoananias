import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface CriarDesafioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
}

export function CriarDesafioDialog({ open, onOpenChange, churchId }: CriarDesafioDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nome: '',
    tipo_publico: 'PROFESSORES' as 'PROFESSORES' | 'ALUNOS',
    tempo_limite_minutos: 30,
    num_perguntas_desbloqueio: 5,
    num_blocos_charada: 3,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create desafio
      const { data: desafio, error: desafioError } = await supabase
        .from('desafio_biblico')
        .insert({
          church_id: churchId,
          nome: formData.nome,
          tipo_publico: formData.tipo_publico,
          tempo_limite_minutos: formData.tempo_limite_minutos,
          num_perguntas_desbloqueio: formData.num_perguntas_desbloqueio,
          num_blocos_charada: formData.num_blocos_charada,
          status: 'CONFIGURANDO',
        })
        .select()
        .single();

      if (desafioError) throw desafioError;

      // Create both teams
      const { error: equipesError } = await supabase
        .from('desafio_equipe')
        .insert([
          { desafio_id: desafio.id, nome: 'EQUIPE_A' },
          { desafio_id: desafio.id, nome: 'EQUIPE_B' },
        ]);

      if (equipesError) throw equipesError;

      return desafio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['desafios-biblicos'] });
      toast.success('Desafio criado com sucesso!');
      onOpenChange(false);
      setFormData({
        nome: '',
        tipo_publico: 'PROFESSORES',
        tempo_limite_minutos: 30,
        num_perguntas_desbloqueio: 5,
        num_blocos_charada: 3,
      });
    },
    onError: (error) => {
      console.error('Error creating desafio:', error);
      toast.error('Erro ao criar desafio');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error('Informe o nome do desafio');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Desafio Bíblico</DialogTitle>
          <DialogDescription>
            Configure os parâmetros do desafio
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Desafio</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Desafio do 1º Trimestre"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo_publico">Tipo de Público</Label>
            <Select
              value={formData.tipo_publico}
              onValueChange={(value: 'PROFESSORES' | 'ALUNOS') =>
                setFormData({ ...formData, tipo_publico: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROFESSORES">Professores</SelectItem>
                <SelectItem value="ALUNOS">Alunos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tempo">Tempo Limite (minutos)</Label>
            <Input
              id="tempo"
              type="number"
              min={5}
              max={120}
              value={formData.tempo_limite_minutos}
              onChange={(e) =>
                setFormData({ ...formData, tempo_limite_minutos: parseInt(e.target.value) || 30 })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="desbloqueio">Perguntas Desbloqueio</Label>
              <Input
                id="desbloqueio"
                type="number"
                min={1}
                max={20}
                value={formData.num_perguntas_desbloqueio}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    num_perguntas_desbloqueio: parseInt(e.target.value) || 5,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charada">Perguntas Charada</Label>
              <Input
                id="charada"
                type="number"
                min={1}
                max={20}
                value={formData.num_blocos_charada}
                onChange={(e) =>
                  setFormData({ ...formData, num_blocos_charada: parseInt(e.target.value) || 3 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Cada charada tem resposta de 4 dígitos
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Desafio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
