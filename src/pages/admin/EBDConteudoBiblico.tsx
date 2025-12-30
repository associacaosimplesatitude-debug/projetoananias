import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, BookOpen, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ConteudoBiblico {
  id: string;
  revista_id: string;
  licao_numero: number;
  texto_aureo: string | null;
  dia1_livro: string;
  dia1_versiculo: string;
  dia2_livro: string;
  dia2_versiculo: string;
  dia3_livro: string;
  dia3_versiculo: string;
  dia4_livro: string;
  dia4_versiculo: string;
  dia5_livro: string;
  dia5_versiculo: string;
  dia6_livro: string;
  dia6_versiculo: string;
  pergunta: string;
  resposta_correta: string;
}

interface Revista {
  id: string;
  titulo: string;
  faixa_etaria_alvo: string;
  num_licoes: number;
}

const DIAS = [
  { num: 1, label: "Dia 1 (6 dias antes)" },
  { num: 2, label: "Dia 2 (5 dias antes)" },
  { num: 3, label: "Dia 3 (4 dias antes)" },
  { num: 4, label: "Dia 4 (3 dias antes)" },
  { num: 5, label: "Dia 5 (2 dias antes)" },
  { num: 6, label: "Dia 6 (1 dia antes)" },
];

export default function EBDConteudoBiblico() {
  const queryClient = useQueryClient();
  const [selectedRevista, setSelectedRevista] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConteudo, setEditingConteudo] = useState<ConteudoBiblico | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    licao_numero: 1,
    texto_aureo: "",
    dia1_livro: "",
    dia1_versiculo: "",
    dia2_livro: "",
    dia2_versiculo: "",
    dia3_livro: "",
    dia3_versiculo: "",
    dia4_livro: "",
    dia4_versiculo: "",
    dia5_livro: "",
    dia5_versiculo: "",
    dia6_livro: "",
    dia6_versiculo: "",
    pergunta: "",
    resposta_correta: "",
  });

  // Fetch revistas
  const { data: revistas = [] } = useQuery({
    queryKey: ["revistas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_revistas")
        .select("id, titulo, faixa_etaria_alvo, num_licoes")
        .order("titulo");
      if (error) throw error;
      return data as Revista[];
    },
  });

  // Fetch conteudos for selected revista
  const { data: conteudos = [] } = useQuery({
    queryKey: ["conteudos-biblicos", selectedRevista],
    queryFn: async () => {
      if (!selectedRevista) return [];
      const { data, error } = await supabase
        .from("ebd_desafio_biblico_conteudo")
        .select("*")
        .eq("revista_id", selectedRevista)
        .order("licao_numero");
      if (error) throw error;
      return data as ConteudoBiblico[];
    },
    enabled: !!selectedRevista,
  });

  const selectedRevistaData = revistas.find((r) => r.id === selectedRevista);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        revista_id: selectedRevista,
        licao_numero: data.licao_numero,
        texto_aureo: data.texto_aureo || null,
        dia1_livro: data.dia1_livro,
        dia1_versiculo: data.dia1_versiculo,
        dia2_livro: data.dia2_livro,
        dia2_versiculo: data.dia2_versiculo,
        dia3_livro: data.dia3_livro,
        dia3_versiculo: data.dia3_versiculo,
        dia4_livro: data.dia4_livro,
        dia4_versiculo: data.dia4_versiculo,
        dia5_livro: data.dia5_livro,
        dia5_versiculo: data.dia5_versiculo,
        dia6_livro: data.dia6_livro,
        dia6_versiculo: data.dia6_versiculo,
        pergunta: data.pergunta,
        resposta_correta: data.resposta_correta,
      };

      if (editingConteudo) {
        const { error } = await supabase
          .from("ebd_desafio_biblico_conteudo")
          .update(payload)
          .eq("id", editingConteudo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ebd_desafio_biblico_conteudo")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conteudos-biblicos", selectedRevista] });
      toast.success(editingConteudo ? "Conteúdo atualizado!" : "Conteúdo cadastrado!");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate key")) {
        toast.error("Já existe conteúdo para esta lição");
      } else {
        toast.error("Erro ao salvar conteúdo");
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ebd_desafio_biblico_conteudo")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conteudos-biblicos", selectedRevista] });
      toast.success("Conteúdo excluído!");
    },
    onError: () => {
      toast.error("Erro ao excluir conteúdo");
    },
  });

  const resetForm = () => {
    setFormData({
      licao_numero: 1,
      texto_aureo: "",
      dia1_livro: "",
      dia1_versiculo: "",
      dia2_livro: "",
      dia2_versiculo: "",
      dia3_livro: "",
      dia3_versiculo: "",
      dia4_livro: "",
      dia4_versiculo: "",
      dia5_livro: "",
      dia5_versiculo: "",
      dia6_livro: "",
      dia6_versiculo: "",
      pergunta: "",
      resposta_correta: "",
    });
    setEditingConteudo(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (conteudo: ConteudoBiblico) => {
    setEditingConteudo(conteudo);
    setFormData({
      licao_numero: conteudo.licao_numero,
      texto_aureo: conteudo.texto_aureo || "",
      dia1_livro: conteudo.dia1_livro,
      dia1_versiculo: conteudo.dia1_versiculo,
      dia2_livro: conteudo.dia2_livro,
      dia2_versiculo: conteudo.dia2_versiculo,
      dia3_livro: conteudo.dia3_livro,
      dia3_versiculo: conteudo.dia3_versiculo,
      dia4_livro: conteudo.dia4_livro,
      dia4_versiculo: conteudo.dia4_versiculo,
      dia5_livro: conteudo.dia5_livro,
      dia5_versiculo: conteudo.dia5_versiculo,
      dia6_livro: conteudo.dia6_livro,
      dia6_versiculo: conteudo.dia6_versiculo,
      pergunta: conteudo.pergunta,
      resposta_correta: conteudo.resposta_correta,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRevista) {
      toast.error("Selecione uma revista");
      return;
    }
    saveMutation.mutate(formData);
  };

  // Get available licoes for dropdown
  const getAvailableLicoes = () => {
    const numLicoes = selectedRevistaData?.num_licoes || 13;
    const usedLicoes = conteudos.map((c) => c.licao_numero);
    const allLicoes = Array.from({ length: numLicoes }, (_, i) => i + 1);
    
    if (editingConteudo) {
      return allLicoes;
    }
    return allLicoes.filter((l) => !usedLicoes.includes(l));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conteúdo Bíblico</h1>
          <p className="text-muted-foreground">
            Cadastre o conteúdo de leitura diária para o Desafio Bíblico
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Selecione a Revista
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>Revista</Label>
              <Select value={selectedRevista} onValueChange={setSelectedRevista}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma revista" />
                </SelectTrigger>
                <SelectContent>
                  {revistas.map((revista) => (
                    <SelectItem key={revista.id} value={revista.id}>
                      {revista.titulo} - {revista.faixa_etaria_alvo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRevista && (
              <Button onClick={openAddDialog} disabled={getAvailableLicoes().length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Conteúdo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedRevista && (
        <Card>
          <CardHeader>
            <CardTitle>Lições Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {conteudos.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum conteúdo cadastrado para esta revista
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {conteudos.map((conteudo) => (
                  <Card key={conteudo.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">Lição {conteudo.licao_numero}</Badge>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(conteudo)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Excluir este conteúdo?")) {
                                deleteMutation.mutate(conteudo.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      {conteudo.texto_aureo && (
                        <p className="text-muted-foreground italic line-clamp-2">
                          "{conteudo.texto_aureo}"
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {DIAS.map((dia) => (
                          <span key={dia.num} className="text-muted-foreground">
                            D{dia.num}: {conteudo[`dia${dia.num}_livro` as keyof ConteudoBiblico]} {conteudo[`dia${dia.num}_versiculo` as keyof ConteudoBiblico]}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Pergunta:</strong> {conteudo.pergunta.substring(0, 50)}...
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog for adding/editing content */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingConteudo ? "Editar Conteúdo" : "Adicionar Conteúdo"} - {selectedRevistaData?.titulo}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <form onSubmit={handleSubmit} className="space-y-6 p-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Lição</Label>
                  <Select
                    value={formData.licao_numero.toString()}
                    onValueChange={(v) => setFormData({ ...formData, licao_numero: parseInt(v) })}
                    disabled={!!editingConteudo}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableLicoes().map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          Lição {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Texto Áureo (opcional)</Label>
                  <Input
                    value={formData.texto_aureo}
                    onChange={(e) => setFormData({ ...formData, texto_aureo: e.target.value })}
                    placeholder="Ex: João 3:16"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Leituras Diárias (6 dias antes da aula)</h3>
                {DIAS.map((dia) => (
                  <div key={dia.num} className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{dia.label} - Livro</Label>
                      <Input
                        value={formData[`dia${dia.num}_livro` as keyof typeof formData] as string}
                        onChange={(e) =>
                          setFormData({ ...formData, [`dia${dia.num}_livro`]: e.target.value })
                        }
                        placeholder="Ex: Lamentações"
                        required
                      />
                    </div>
                    <div>
                      <Label>Versículo</Label>
                      <Input
                        value={formData[`dia${dia.num}_versiculo` as keyof typeof formData] as string}
                        onChange={(e) =>
                          setFormData({ ...formData, [`dia${dia.num}_versiculo`]: e.target.value })
                        }
                        placeholder="Ex: 3.22-23"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Gamificação</h3>
                <div>
                  <Label>Pergunta</Label>
                  <Textarea
                    value={formData.pergunta}
                    onChange={(e) => setFormData({ ...formData, pergunta: e.target.value })}
                    placeholder="Digite a pergunta sobre a lição..."
                    required
                  />
                </div>
                <div>
                  <Label>Resposta Correta</Label>
                  <Input
                    value={formData.resposta_correta}
                    onChange={(e) => setFormData({ ...formData, resposta_correta: e.target.value })}
                    placeholder="Digite a resposta correta..."
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
