import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FAIXAS_ETARIAS } from "@/constants/ebdFaixasEtarias";
import { ArrowLeft, School } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormData {
  faixa_etaria_id: string;
  nome_turma: string;
}

export default function ClassroomForm() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const [searchParams] = useSearchParams();
  const turmaId = searchParams.get("id");
  const isEditing = !!turmaId;

  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    defaultValues: {
      faixa_etaria_id: "",
      nome_turma: "",
    }
  });
  const { handleSubmit, setValue } = form;

  // Buscar church_id usando a mesma lógica do useEbdChurchId
  const { data: churchData, isLoading: loadingChurch } = useQuery({
    queryKey: ["church-data-form", clientId],
    queryFn: async () => {
      // Admin (visualizando um cliente específico)
      if (clientId) {
        // Tentar buscar em ebd_clientes primeiro
        const { data: cliente, error: clienteError } = await supabase
          .from("ebd_clientes")
          .select("id, nome_igreja")
          .eq("id", clientId)
          .maybeSingle();

        if (!clienteError && cliente) {
          return { id: cliente.id, church_name: cliente.nome_igreja };
        }

        // Se não encontrar, buscar em churches
        const { data, error } = await supabase
          .from("churches")
          .select("id, church_name")
          .eq("id", clientId)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Igreja não encontrada");
        return data;
      }

      // Superintendente (módulo EBD) - usar mesma lógica do useEbdChurchId
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1) Promoted superintendent via ebd_user_roles
      const { data: promotedRole } = await supabase
        .from("ebd_user_roles")
        .select("church_id")
        .eq("user_id", user.id)
        .eq("role", "superintendente")
        .limit(1)
        .maybeSingle();
      
      if (promotedRole?.church_id) {
        const { data: cliente } = await supabase
          .from("ebd_clientes")
          .select("id, nome_igreja")
          .eq("id", promotedRole.church_id)
          .maybeSingle();
        if (cliente) {
          return { id: cliente.id, church_name: cliente.nome_igreja };
        }
      }

      // 2) Legacy superintendent via ebd_clientes.superintendente_user_id
      const { data: cliente, error: clienteError } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .eq("superintendente_user_id", user.id)
        .eq("status_ativacao_ebd", true)
        .maybeSingle();

      if (!clienteError && cliente) {
        return { id: cliente.id, church_name: cliente.nome_igreja };
      }

      // 3) Church owner
      const { data: church } = await supabase
        .from("churches")
        .select("id, church_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (church) {
        return { id: church.id, church_name: church.church_name };
      }

      throw new Error("Igreja não encontrada para este usuário");
    },
  });

  // Buscar turma se estiver editando
  const { data: turma } = useQuery({
    queryKey: ["ebd-turma", turmaId],
    queryFn: async () => {
      if (!turmaId) return null;
      const { data, error } = await supabase
        .from("ebd_turmas")
        .select("*")
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
    }
  }, [turma, setValue]);

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
          })
          .eq("id", turmaId);

        if (turmaError) throw turmaError;
        return { id: turmaId };
      } else {
        // Criar nova turma
        const { data: novaTurma, error: turmaError } = await supabase
          .from("ebd_turmas")
          .insert({
            church_id: churchData.id,
            nome: formData.nome_turma.trim(),
            faixa_etaria: formData.faixa_etaria_id,
          })
          .select()
          .single();

        if (turmaError) throw turmaError;
        return novaTurma;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Turma atualizada com sucesso!" : "Turma cadastrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ebd-turmas"] });
      queryClient.invalidateQueries({ queryKey: ["ebd-onboarding-progress"] });
      // Redirecionar para o dashboard para ver progresso da gamificação (no contexto EBD)
      // Ou para lista de turmas no contexto admin
      navigate(clientId ? `/admin/clients/${clientId}/ebd/turmas` : "/ebd/dashboard");
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
    navigate(clientId ? `/admin/clients/${clientId}/ebd/turmas` : "/ebd/dashboard");
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
      <div className="max-w-2xl mx-auto space-y-6">
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

            {/* Botões de Ação */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveTurmaMutation.isPending}>
                {saveTurmaMutation.isPending 
                  ? (isEditing ? "Salvando..." : "Salvando...") 
                  : (isEditing ? "Salvar Alterações" : "Salvar Turma")
                }
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
