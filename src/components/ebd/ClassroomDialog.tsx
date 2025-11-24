import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
}

interface FormData {
  nome: string;
  faixa_etaria: string;
  descricao?: string;
}

const FAIXAS_ETARIAS = [
  "0-3 anos",
  "4-6 anos",
  "7-10 anos",
  "11-14 anos (Adolescentes)",
  "15-18 anos (Jovens)",
  "19-30 anos (Jovens Adultos)",
  "31+ anos (Adultos)",
  "Todas as idades"
];

export default function ClassroomDialog({ open, onOpenChange, churchId }: ClassroomDialogProps) {
  const [selectedProfessores, setSelectedProfessores] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>();

  // Buscar professores ativos
  const { data: professores, isLoading: loadingProfessores } = useQuery({
    queryKey: ["ebd-professores-active", churchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_professores")
        .select("*")
        .eq("church_id", churchId)
        .eq("is_active", true)
        .order("nome_completo");
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!churchId,
  });

  const createTurmaMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // 1. Criar a turma
      const { data: turma, error: turmaError } = await supabase
        .from("ebd_turmas")
        .insert({
          church_id: churchId,
          nome: formData.nome,
          faixa_etaria: formData.faixa_etaria,
          descricao: formData.descricao || null,
        })
        .select()
        .single();

      if (turmaError) throw turmaError;

      // 2. Criar os vínculos com professores
      if (selectedProfessores.length > 0) {
        const vinculos = selectedProfessores.map(professorId => ({
          turma_id: turma.id,
          professor_id: professorId,
        }));

        const { error: vinculosError } = await supabase
          .from("ebd_professores_turmas")
          .insert(vinculos);

        if (vinculosError) throw vinculosError;
      }

      return turma;
    },
    onSuccess: () => {
      toast.success("Sala cadastrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ebd-turmas"] });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Erro ao criar sala:", error);
      toast.error("Erro ao cadastrar sala: " + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    createTurmaMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setSelectedProfessores([]);
    onOpenChange(false);
  };

  const toggleProfessor = (professorId: string) => {
    setSelectedProfessores(prev =>
      prev.includes(professorId)
        ? prev.filter(id => id !== professorId)
        : [...prev, professorId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Sala</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Turma *</Label>
            <Input
              id="nome"
              {...register("nome", { required: "Nome é obrigatório" })}
              placeholder="Ex: Crianças A, Jovens, Adultos..."
            />
            {errors.nome && (
              <p className="text-sm text-destructive">{errors.nome.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="faixa_etaria">Faixa Etária *</Label>
            <Select
              onValueChange={(value) => setValue("faixa_etaria", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a faixa etária" />
              </SelectTrigger>
              <SelectContent>
                {FAIXAS_ETARIAS.map((faixa) => (
                  <SelectItem key={faixa} value={faixa}>
                    {faixa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.faixa_etaria && (
              <p className="text-sm text-destructive">{errors.faixa_etaria.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (Opcional)</Label>
            <Input
              id="descricao"
              {...register("descricao")}
              placeholder="Informações adicionais sobre a turma"
            />
          </div>

          <div className="space-y-2">
            <Label>Professores</Label>
            <p className="text-sm text-muted-foreground">
              Selecione um ou mais professores para esta sala
            </p>
            
            {loadingProfessores ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : professores && professores.length > 0 ? (
              <ScrollArea className="h-[200px] border rounded-md p-4">
                <div className="space-y-3">
                  {professores.map((professor) => (
                    <div key={professor.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={professor.id}
                        checked={selectedProfessores.includes(professor.id)}
                        onCheckedChange={() => toggleProfessor(professor.id)}
                      />
                      <Label
                        htmlFor={professor.id}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {professor.nome_completo}
                        {professor.email && (
                          <span className="text-muted-foreground ml-2">
                            ({professor.email})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                Nenhum professor cadastrado. Cadastre professores primeiro.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTurmaMutation.isPending}>
              {createTurmaMutation.isPending ? "Salvando..." : "Salvar Sala"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
