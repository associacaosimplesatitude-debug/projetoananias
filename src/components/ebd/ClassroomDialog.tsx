import { useState, useEffect } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FAIXAS_ETARIAS } from "@/constants/ebdFaixasEtarias";

interface Turma {
  id: string;
  nome: string;
  faixa_etaria: string;
  descricao?: string | null;
  responsavel_chamada?: string;
  responsavel_dados_aula?: string;
  responsavel_pontuacao?: string;
  permite_lancamento_ofertas?: boolean;
  permite_lancamento_revistas?: boolean;
  permite_lancamento_biblias?: boolean;
  ebd_professores_turmas?: {
    professor_id: string;
    ebd_professores: { id: string; nome_completo: string } | null;
  }[];
}

interface ClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  turma?: Turma | null;
}

interface FormData {
  faixa_etaria_id: string;
  nome_turma: string;
  responsavel_chamada: string;
  responsavel_dados_aula: string;
  responsavel_pontuacao: string;
  permite_lancamento_ofertas: boolean;
  permite_lancamento_revistas: boolean;
  permite_lancamento_biblias: boolean;
}

export default function ClassroomDialog({ open, onOpenChange, churchId, turma }: ClassroomDialogProps) {
  const [selectedProfessores, setSelectedProfessores] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const isEditing = !!turma;

  const form = useForm<FormData>({
    defaultValues: {
      faixa_etaria_id: "",
      nome_turma: "",
      responsavel_chamada: "Professor",
      responsavel_dados_aula: "Professor",
      responsavel_pontuacao: "Professor",
      permite_lancamento_ofertas: true,
      permite_lancamento_revistas: true,
      permite_lancamento_biblias: true,
    }
  });
  const { handleSubmit, reset, setValue, watch } = form;
  
  const responsavelChamada = watch("responsavel_chamada");

  // Carregar dados da turma ao editar
  useEffect(() => {
    if (turma && open) {
      setValue("nome_turma", turma.nome);
      setValue("faixa_etaria_id", turma.faixa_etaria);
      setValue("responsavel_chamada", turma.responsavel_chamada || "Professor");
      setValue("responsavel_dados_aula", turma.responsavel_dados_aula || "Professor");
      setValue("responsavel_pontuacao", turma.responsavel_pontuacao || "Professor");
      setValue("permite_lancamento_ofertas", turma.permite_lancamento_ofertas ?? true);
      setValue("permite_lancamento_revistas", turma.permite_lancamento_revistas ?? true);
      setValue("permite_lancamento_biblias", turma.permite_lancamento_biblias ?? true);
      
      const professorIds = turma.ebd_professores_turmas
        ?.map(pt => pt.professor_id)
        .filter(Boolean) || [];
      setSelectedProfessores(professorIds);
    } else if (!open) {
      reset();
      setSelectedProfessores([]);
    }
  }, [turma, open, setValue, reset]);

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

  const saveTurmaMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!formData.faixa_etaria_id) {
        throw new Error("Faixa etária não selecionada");
      }

      if (!formData.nome_turma.trim()) {
        throw new Error("Nome da turma é obrigatório");
      }

      if (isEditing && turma) {
        // Atualizar turma existente
        const { error: turmaError } = await supabase
          .from("ebd_turmas")
          .update({
            nome: formData.nome_turma.trim(),
            faixa_etaria: formData.faixa_etaria_id,
            responsavel_chamada: formData.responsavel_chamada,
            responsavel_dados_aula: formData.responsavel_dados_aula,
            responsavel_pontuacao: formData.responsavel_pontuacao,
            permite_lancamento_ofertas: formData.permite_lancamento_ofertas,
            permite_lancamento_revistas: formData.permite_lancamento_revistas,
            permite_lancamento_biblias: formData.permite_lancamento_biblias,
          })
          .eq("id", turma.id);

        if (turmaError) throw turmaError;

        // Remover vínculos antigos
        await supabase
          .from("ebd_professores_turmas")
          .delete()
          .eq("turma_id", turma.id);

        // Criar novos vínculos
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
      } else {
        // Criar nova turma
        const { data: novaTurma, error: turmaError } = await supabase
          .from("ebd_turmas")
          .insert({
            church_id: churchId,
            nome: formData.nome_turma.trim(),
            faixa_etaria: formData.faixa_etaria_id,
            responsavel_chamada: formData.responsavel_chamada,
            responsavel_dados_aula: formData.responsavel_dados_aula,
            responsavel_pontuacao: formData.responsavel_pontuacao,
            permite_lancamento_ofertas: formData.permite_lancamento_ofertas,
            permite_lancamento_revistas: formData.permite_lancamento_revistas,
            permite_lancamento_biblias: formData.permite_lancamento_biblias,
          })
          .select()
          .single();

        if (turmaError) throw turmaError;

        // Criar vínculos com professores
        if (selectedProfessores.length > 0) {
          const vinculos = selectedProfessores.map(professorId => ({
            turma_id: novaTurma.id,
            professor_id: professorId,
          }));

          const { error: vinculosError } = await supabase
            .from("ebd_professores_turmas")
            .insert(vinculos);

          if (vinculosError) throw vinculosError;
        }

        return novaTurma;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Turma atualizada com sucesso!" : "Turma cadastrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ebd-turmas"] });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Erro ao salvar turma:", error);
      toast.error("Erro ao salvar turma: " + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    saveTurmaMutation.mutate(data);
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

  // Não renderizar se não tiver churchId válido
  if (!churchId) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Turma" : "Nova Turma"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="faixa_etaria_id"
              rules={{ required: "Faixa etária é obrigatória" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Faixa Etária *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a faixa etária" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background z-[100]" position="popper">
                      {FAIXAS_ETARIAS.map((faixa) => (
                        <SelectItem key={faixa} value={faixa}>
                          {faixa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nome_turma"
              rules={{ required: "Nome da turma é obrigatório" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Turma *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: Cordeirinho de Cristo"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Professores</Label>
              <p className="text-sm text-muted-foreground">
                Selecione um ou mais professores para esta turma
              </p>
              
              {loadingProfessores ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : professores && professores.length > 0 ? (
                <ScrollArea className="h-[150px] border rounded-md p-4">
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

            {/* Seção de Configurações de Lançamento */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label className="text-base font-semibold">Configurações de Lançamento</Label>
                <p className="text-sm text-muted-foreground">
                  Defina quem será responsável e quais dados serão coletados nesta turma
                </p>
              </div>

              {/* Responsável pela Chamada */}
              <FormField
                control={form.control}
                name="responsavel_chamada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável pela Chamada</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
                        <SelectItem value="Professor">Professor/Secretário (Lançamento Manual)</SelectItem>
                        <SelectItem value="Aluno">Aluno (Lançamento Automático)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {responsavelChamada === "Aluno" 
                        ? "O Professor gerará o Código PIN para os alunos registrarem presença automaticamente" 
                        : "O Professor ou Secretário fará a chamada manualmente"}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Funcionalidades de Dados da Aula */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Dados da Aula (coletados pelo Professor)</Label>
                
                <FormField
                  control={form.control}
                  name="permite_lancamento_ofertas"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-normal cursor-pointer">
                          Lançar Ofertas
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Permite registrar o valor das ofertas coletadas na aula
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permite_lancamento_revistas"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-normal cursor-pointer">
                          Contar Revistas
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Permite registrar quantos alunos trouxeram a revista
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permite_lancamento_biblias"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-normal cursor-pointer">
                          Contar Bíblias
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Permite registrar quantos alunos trouxeram a Bíblia
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* Outros responsáveis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <FormField
                  control={form.control}
                  name="responsavel_dados_aula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável pelos Dados da Aula</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="Secretario">Secretário</SelectItem>
                          <SelectItem value="Professor">Professor</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="responsavel_pontuacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável pela Pontuação</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="Professor">Professor</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Resultado de questionários
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveTurmaMutation.isPending}>
                {saveTurmaMutation.isPending ? "Salvando..." : isEditing ? "Salvar Alterações" : "Salvar Turma"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
