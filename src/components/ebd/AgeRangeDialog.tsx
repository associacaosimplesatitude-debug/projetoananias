import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AgeRangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
}

interface FormData {
  nome_faixa: string;
  idade_min: number;
  idade_max: number;
}

export default function AgeRangeDialog({ open, onOpenChange, churchId }: AgeRangeDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      nome_faixa: "",
      idade_min: 0,
      idade_max: 0,
    }
  });

  const { register, handleSubmit, reset, formState: { errors }, watch } = form;

  const idadeMin = watch("idade_min");
  const idadeMax = watch("idade_max");

  const createAgeRangeMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data, error } = await supabase
        .from("ebd_faixas_etarias")
        .insert({
          church_id: churchId,
          nome_faixa: formData.nome_faixa,
          idade_min: Number(formData.idade_min),
          idade_max: Number(formData.idade_max),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Faixa etária cadastrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ebd-age-ranges", churchId] });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Erro ao criar faixa etária:", error);
      toast.error("Erro ao cadastrar faixa etária: " + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    if (Number(data.idade_max) < Number(data.idade_min)) {
      toast.error("Idade máxima deve ser maior ou igual à idade mínima");
      return;
    }
    createAgeRangeMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  if (!churchId) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Faixa Etária</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_faixa">Nome da Faixa *</Label>
            <Input
              id="nome_faixa"
              {...register("nome_faixa", { required: "Nome é obrigatório" })}
              placeholder="Ex: Adolescentes, Raio de Luz"
            />
            {errors.nome_faixa && (
              <p className="text-sm text-destructive">{errors.nome_faixa.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="idade_min">Idade Mínima *</Label>
              <Input
                id="idade_min"
                type="number"
                min="0"
                {...register("idade_min", { 
                  required: "Idade mínima é obrigatória",
                  min: { value: 0, message: "Idade mínima deve ser 0 ou maior" }
                })}
                placeholder="Ex: 12"
              />
              {errors.idade_min && (
                <p className="text-sm text-destructive">{errors.idade_min.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="idade_max">Idade Máxima *</Label>
              <Input
                id="idade_max"
                type="number"
                min="0"
                {...register("idade_max", { 
                  required: "Idade máxima é obrigatória",
                  min: { value: 0, message: "Idade máxima deve ser 0 ou maior" }
                })}
                placeholder="Ex: 14"
              />
              {errors.idade_max && (
                <p className="text-sm text-destructive">{errors.idade_max.message}</p>
              )}
            </div>
          </div>

          {idadeMin !== undefined && idadeMax !== undefined && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Preview:</span> {form.watch("nome_faixa") || "Nome da Faixa"} {idadeMin}-{idadeMax}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createAgeRangeMutation.isPending}>
              {createAgeRangeMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
