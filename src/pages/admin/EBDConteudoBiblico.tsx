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
    plano_leitura_texto: "",
  });
  const [parsedReferences, setParsedReferences] = useState<Array<{ livro: string; versiculo: string }>>([]);

  // Parse Bible references from text
  const parseReferences = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const refs: Array<{ livro: string; versiculo: string }> = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Match patterns like "Lamentações 3.22-23" or "1 João 3:16" or "Salmos 23.1-6"
      const match = trimmed.match(/^(.+?)\s+(\d+[.:]\d+(?:-\d+)?(?:[.:]\d+)?)$/);
      if (match) {
        refs.push({ livro: match[1].trim(), versiculo: match[2].trim() });
      } else {
        // Try to split on last space before number
        const lastNumMatch = trimmed.match(/^(.+?)\s+(\d.*)$/);
        if (lastNumMatch) {
          refs.push({ livro: lastNumMatch[1].trim(), versiculo: lastNumMatch[2].trim() });
        }
      }
    }
    
    return refs.slice(0, 6);
  };

  // Update parsed references when text changes
  const handlePlanoLeituraChange = (text: string) => {
    setFormData({ ...formData, plano_leitura_texto: text });
    setParsedReferences(parseReferences(text));
  };

  // Convert parsed references to form data for submission
  const getSubmitData = () => {
    const refs = parsedReferences;
    return {
      licao_numero: formData.licao_numero,
      texto_aureo: null,
      dia1_livro: refs[0]?.livro || "",
      dia1_versiculo: refs[0]?.versiculo || "",
      dia2_livro: refs[1]?.livro || "",
      dia2_versiculo: refs[1]?.versiculo || "",
      dia3_livro: refs[2]?.livro || "",
      dia3_versiculo: refs[2]?.versiculo || "",
      dia4_livro: refs[3]?.livro || "",
      dia4_versiculo: refs[3]?.versiculo || "",
      dia5_livro: refs[4]?.livro || "",
      dia5_versiculo: refs[4]?.versiculo || "",
      dia6_livro: refs[5]?.livro || "",
      dia6_versiculo: refs[5]?.versiculo || "",
      pergunta: "",
      resposta_correta: "",
    };
  };

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
    mutationFn: async (submitData: ReturnType<typeof getSubmitData>) => {
      const payload = {
        revista_id: selectedRevista,
        ...submitData,
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
      plano_leitura_texto: "",
    });
    setParsedReferences([]);
    setEditingConteudo(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (conteudo: ConteudoBiblico) => {
    setEditingConteudo(conteudo);
    
    // Reconstruct the text from the 6 days
    const textLines = [];
    for (let i = 1; i <= 6; i++) {
      const livro = conteudo[`dia${i}_livro` as keyof ConteudoBiblico];
      const versiculo = conteudo[`dia${i}_versiculo` as keyof ConteudoBiblico];
      if (livro && versiculo) {
        textLines.push(`${livro} ${versiculo}`);
      }
    }
    
    const planoTexto = textLines.join('\n');
    setFormData({
      licao_numero: conteudo.licao_numero,
      plano_leitura_texto: planoTexto,
    });
    setParsedReferences(parseReferences(planoTexto));
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRevista) {
      toast.error("Selecione uma revista");
      return;
    }
    if (parsedReferences.length < 6) {
      toast.error("Informe as 6 referências bíblicas (uma por linha)");
      return;
    }
    saveMutation.mutate(getSubmitData());
  };

  // Get available licoes for dropdown
  const getAvailableLicoes = () => {
    const numLicoes = selectedRevistaData?.num_licoes && selectedRevistaData.num_licoes > 0 
      ? selectedRevistaData.num_licoes 
      : 13;
    const usedLicoes = conteudos.map((c) => c.licao_numero);
    const allLicoes = Array.from({ length: numLicoes }, (_, i) => i + 1);
    
    if (editingConteudo) {
      return allLicoes;
    }
    return allLicoes.filter((l) => !usedLicoes.includes(l));
  };

  const availableLicoes = getAvailableLicoes();

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
              <Button onClick={openAddDialog} disabled={availableLicoes.length === 0}>
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
                    {availableLicoes.map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        Lição {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Plano de Leitura Diária (Cole aqui as 6 referências, uma por linha)</Label>
                  <Textarea
                    value={formData.plano_leitura_texto}
                    onChange={(e) => handlePlanoLeituraChange(e.target.value)}
                    placeholder={`Exemplo:\nLamentações 3.22-23\nSalmos 23.1-6\nJoão 3.16-17\nRomanos 8.28-30\n1 Coríntios 13.1-8\nFilipenses 4.6-7`}
                    rows={8}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Formato: Livro Capítulo.Versículo (ex: Lamentações 3.22-23)
                  </p>
                </div>
                
                {parsedReferences.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-2">Referências identificadas ({parsedReferences.length}/6):</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {parsedReferences.map((ref, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Badge variant={parsedReferences.length === 6 ? "default" : "secondary"} className="w-12 justify-center">
                            Dia {idx + 1}
                          </Badge>
                          <span className="text-muted-foreground">{ref.livro}</span>
                          <span>{ref.versiculo}</span>
                        </div>
                      ))}
                    </div>
                    {parsedReferences.length < 6 && (
                      <p className="text-xs text-destructive mt-2">
                        Faltam {6 - parsedReferences.length} referência(s)
                      </p>
                    )}
                  </div>
                )}
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
