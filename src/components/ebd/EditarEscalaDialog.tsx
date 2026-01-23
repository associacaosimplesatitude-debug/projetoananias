import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Escala {
  id: string;
  data: string;
  sem_aula: boolean;
  professor_id: string | null;
  professor_id_2?: string | null;
  turma_id: string;
  tipo: string;
  observacao: string | null;
}

interface EditarEscalaDialogProps {
  escala: Escala | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId?: string;
}

interface Professor {
  id: string;
  nome_completo: string;
}

export function EditarEscalaDialog({ escala, open, onOpenChange, churchId }: EditarEscalaDialogProps) {
  const queryClient = useQueryClient();
  const [professorId, setProfessorId] = useState<string>("");
  const [professor2Id, setProfessor2Id] = useState<string>("");
  const [semAula, setSemAula] = useState(false);

  useEffect(() => {
    if (escala) {
      setProfessorId(escala.professor_id || "");
      setProfessor2Id(escala.professor_id_2 || "");
      setSemAula(escala.sem_aula);
    }
  }, [escala]);

  // Buscar professores ativos
  const { data: professores } = useQuery({
    queryKey: ['ebd-professores', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ebd_professores')
        .select('id, nome_completo')
        .eq('church_id', churchId)
        .eq('is_active', true)
        .order('nome_completo');

      if (error) throw error;
      return data as Professor[];
    },
    enabled: !!churchId && open,
  });

  const atualizarEscalaMutation = useMutation({
    mutationFn: async () => {
      if (!escala) throw new Error("Escala não encontrada");

      if (!semAula && !professorId) {
        throw new Error("Selecione um professor ou marque como 'Sem aula'");
      }

      const { error } = await supabase
        .from('ebd_escalas')
        .update({
          professor_id: semAula ? null : professorId,
          professor_id_2: semAula ? null : (professor2Id || null),
          sem_aula: semAula,
        })
        .eq('id', escala.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-escalas'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-escalas-planejamento'] });
      toast.success('Escala atualizada com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar escala');
    },
  });

  if (!escala) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Escala</DialogTitle>
          <DialogDescription>
            <div className="flex items-center gap-1 mt-1">
              <Calendar className="h-4 w-4" />
              <span>{format(parseISO(escala.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="sem-aula-edit"
              checked={semAula}
              onCheckedChange={(checked) => {
                setSemAula(checked as boolean);
                if (checked) {
                  setProfessorId("");
                }
              }}
            />
            <label 
              htmlFor="sem-aula-edit"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Sem aula nesta data
            </label>
          </div>

          {!semAula && (
            <>
              <div>
                <Label htmlFor="professor-edit" className="text-sm font-medium mb-2 block">
                  Professor Principal *
                </Label>
                <Select value={professorId} onValueChange={setProfessorId}>
                  <SelectTrigger id="professor-edit">
                    <SelectValue placeholder="Selecionar professor" />
                  </SelectTrigger>
                  <SelectContent>
                    {professores?.map((professor) => (
                      <SelectItem key={professor.id} value={professor.id}>
                        {professor.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="professor2-edit" className="text-sm font-medium mb-2 block">
                  Professor Auxiliar (opcional)
                </Label>
                <Select value={professor2Id} onValueChange={setProfessor2Id}>
                  <SelectTrigger id="professor2-edit">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {professores?.filter(p => p.id !== professorId).map((professor) => (
                      <SelectItem key={professor.id} value={professor.id}>
                        {professor.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => atualizarEscalaMutation.mutate()}
            disabled={atualizarEscalaMutation.isPending}
          >
            {atualizarEscalaMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
