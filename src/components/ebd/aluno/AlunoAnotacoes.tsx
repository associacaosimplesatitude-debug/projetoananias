import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PenLine, Plus, Edit, Trash2, Save, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AlunoAnotacoesProps {
  alunoId: string;
  churchId: string;
}

interface Anotacao {
  id: string;
  titulo: string | null;
  conteudo: string | null;
  created_at: string;
  updated_at: string;
}

export function AlunoAnotacoes({ alunoId, churchId }: AlunoAnotacoesProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");

  const { data: anotacoes, isLoading } = useQuery({
    queryKey: ["aluno-anotacoes", alunoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_anotacoes")
        .select("*")
        .eq("aluno_id", alunoId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Anotacao[];
    },
    enabled: !!alunoId,
  });

  const salvarAnotacao = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from("ebd_anotacoes")
          .update({ titulo, conteudo, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ebd_anotacoes").insert({
          aluno_id: alunoId,
          church_id: churchId,
          titulo,
          conteudo,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno-anotacoes", alunoId] });
      toast.success(editingId ? "Anotação atualizada!" : "Anotação criada!");
      resetForm();
    },
    onError: () => {
      toast.error("Erro ao salvar anotação");
    },
  });

  const excluirAnotacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ebd_anotacoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno-anotacoes", alunoId] });
      toast.success("Anotação excluída!");
    },
    onError: () => {
      toast.error("Erro ao excluir anotação");
    },
  });

  const resetForm = () => {
    setDialogOpen(false);
    setEditingId(null);
    setTitulo("");
    setConteudo("");
  };

  const handleEdit = (anotacao: Anotacao) => {
    setEditingId(anotacao.id);
    setTitulo(anotacao.titulo || "");
    setConteudo(anotacao.conteudo || "");
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <PenLine className="w-5 h-5" />
          Minhas Anotações
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-1" />
              Nova
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Anotação" : "Nova Anotação"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Título (opcional)"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
              <Textarea
                placeholder="Escreva suas anotações aqui..."
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                rows={8}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => salvarAnotacao.mutate()}
                  disabled={!conteudo.trim() || salvarAnotacao.isPending}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!anotacoes?.length ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhuma anotação ainda</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Comece a registrar suas anotações das aulas.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Criar primeira anotação
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {anotacoes.map((anotacao) => (
                <Card key={anotacao.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium mb-1">
                          {anotacao.titulo || "Sem título"}
                        </h4>
                        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                          {anotacao.conteudo}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          Atualizado em{" "}
                          {format(new Date(anotacao.updated_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(anotacao)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => excluirAnotacao.mutate(anotacao.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
