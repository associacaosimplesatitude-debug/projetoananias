import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FAIXAS_ETARIAS } from "@/constants/ebdFaixasEtarias";
import { ArrowLeft, School, Users, Settings } from "lucide-react";

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

export default function ClassroomForm() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [searchParams] = useSearchParams();
  const turmaId = searchParams.get("id");
  const isEditing = !!turmaId;

  const [selectedProfessores, setSelectedProfessores] = useState<string[]>([]);
  const queryClient = useQueryClient();

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

  // Buscar church_id
  const { data: churchData, isLoading: loadingChurch } = useQuery({
    queryKey: ["church-data", clientId],
    queryFn: async () => {
      if (clientId) {
        const { data, error } = await supabase
          .from("churches")
          .select("*")
          .eq("id", clientId)
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        const { data, error } = await supabase
          .from("churches")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (error) throw error;
        return data;
      }
    },
  });

  // Buscar turma se estiver editando
  const { data: turma } = useQuery({
    queryKey: ["ebd-turma", turmaId],
    queryFn: async () => {
      if (!turmaId) return null;
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select(`
          *,
          ebd_professores_turmas (
            professor_id,
            ebd_professores (
              id,
              nome_completo
            )
          )
        `)
        .eq("id", turmaId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!turmaId,
  });

  // Carregar dados da turma ao editar
  useEffect(() => {
    if (turma) {
      setValue("nome_turma", turma.nome);
      setValue("faixa_etaria_id", turma.faixa_etaria);
      setValue("responsavel_chamada", turma.responsavel_chamada || "Professor");
      setValue("responsavel_dados_aula", turma.responsavel_dados_aula || "Professor");
      setValue("responsavel_pontuacao", turma.responsavel_pontuacao || "Professor");
      setValue("permite_lancamento_ofertas", turma.permite_lancamento_ofertas ?? true);
      setValue("permite_lancamento_revistas", turma.permite_lancamento_revistas ?? true);
      setValue("permite_lancamento_biblias", turma.permite_lancamento_biblias ?? true);
      
      const professorIds = turma.ebd_professores_turmas
        ?.map((pt: any) => pt.professor_id)
        .filter(Boolean) || [];
      setSelectedProfessores(professorIds);
    }
  }, [turma, setValue]);

  // Buscar professores ativos
  const { data: professores, isLoading: loadingProfessores } = useQuery({
    queryKey: ["ebd-professores-active", churchData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_professores")
        .select("*")
        .eq("church_id", churchData!.id)
        .eq("is_active", true)
        .order("nome_completo");
      
      if (error) throw error;
      return data;
    },
    enabled: !!churchData?.id,
  });

  const saveTurmaMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!formData.faixa_etaria_id) {
        throw new Error("Faixa etária não selecionada");
      }

      if (!formData.nome_turma.trim()) {
        throw new Error("Nome da turma é obrigatório");
      }

      if (!churchData?.id) {
        throw new Error("Igreja não encontrada");
      }

      if (isEditing && turmaId) {
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
          .eq("id", turmaId);

        if (turmaError) throw turmaError;

        // Remover vínculos antigos
        await supabase
          .from("ebd_professores_turmas")
          .delete()
          .eq("turma_id", turmaId);

        // Criar novos vínculos
        if (selectedProfessores.length > 0) {
          const vinculos = selectedProfessores.map(professorId => ({
            turma_id: turmaId,
            professor_id: professorId,
          }));

          const { error: vinculosError } = await supabase
            .from("ebd_professores_turmas")
            .insert(vinculos);

          if (vinculosError) throw vinculosError;
        }

        return { id: turmaId };
      } else {
        // Criar nova turma
        const { data: novaTurma, error: turmaError } = await supabase
          .from("ebd_turmas")
          .insert({
            church_id: churchData.id,
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
      navigate(clientId ? `/admin/clients/${clientId}/ebd/turmas` : "/ebd/turmas");
    },
    onError: (error: any) => {
      console.error("Erro ao salvar turma:", error);
      toast.error("Erro ao salvar turma: " + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    saveTurmaMutation.mutate(data);
  };

  const handleCancel = () => {
    navigate(clientId ? `/admin/clients/${clientId}/ebd/turmas` : "/ebd/turmas");
  };

  const toggleProfessor = (professorId: string) => {
    setSelectedProfessores(prev =>
      prev.includes(professorId)
        ? prev.filter(id => id !== professorId)
        : [...prev, professorId]
    );
  };

  if (loadingChurch) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isEditing ? "Editar Turma" : "Nova Turma"}</h1>
            <p className="text-muted-foreground">
              {isEditing ? "Atualize os dados da turma" : "Cadastre uma nova turma da EBD"}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados Básicos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <School className="w-5 h-5" />
                  Dados da Turma
                </CardTitle>
                <CardDescription>Informações básicas da turma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                        <SelectContent className="bg-background">
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
              </CardContent>
            </Card>

            {/* Professores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  Professores
                </CardTitle>
                <CardDescription>Selecione um ou mais professores para esta turma</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingProfessores ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : professores && professores.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {professores.map((professor) => (
                      <div key={professor.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
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
                            <span className="block text-muted-foreground text-xs">
                              {professor.email}
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
                    Nenhum professor cadastrado. Cadastre professores primeiro.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Configurações de Lançamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5" />
                  Configurações de Lançamento
                </CardTitle>
                <CardDescription>
                  Defina quem será responsável e quais dados serão coletados nesta turma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                        <SelectContent className="bg-background">
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
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Dados da Aula (coletados pelo Professor)</Label>
                  
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="permite_lancamento_ofertas"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-lg">
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
                              Registrar ofertas
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="permite_lancamento_revistas"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-lg">
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
                              Registrar revistas
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="permite_lancamento_biblias"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-lg">
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
                              Registrar bíblias
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Outros responsáveis */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
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
                          <SelectContent className="bg-background">
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
                          <SelectContent className="bg-background">
                            <SelectItem value="Secretario">Secretário</SelectItem>
                            <SelectItem value="Professor">Professor</SelectItem>
                            <SelectItem value="Superintendente">Superintendente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Botões de Ação */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveTurmaMutation.isPending}>
                {saveTurmaMutation.isPending 
                  ? (isEditing ? "Salvando..." : "Cadastrando...") 
                  : (isEditing ? "Salvar Alterações" : "Cadastrar Turma")
                }
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
