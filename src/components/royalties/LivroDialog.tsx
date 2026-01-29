import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type PeriodoPagamento = "1_mes" | "3_meses" | "6_meses" | "1_ano";

interface LivroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  livro?: {
    id: string;
    titulo: string;
    isbn?: string | null;
    autor_id: string;
    valor_capa: number;
    is_active: boolean | null;
  } | null;
}

export function LivroDialog({ open, onOpenChange, livro }: LivroDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    titulo: "",
    autor_id: "",
    valor_capa: "",
    percentual_comissao: "",
    periodo_pagamento: "3_meses" as PeriodoPagamento,
    is_active: true,
  });

  const { data: autores = [] } = useQuery({
    queryKey: ["royalties-autores-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_autores")
        .select("id, nome_completo")
        .eq("is_active", true)
        .order("nome_completo");
      
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const loadData = async () => {
      if (livro) {
        // Load commission data if editing
        const { data: comissao } = await supabase
          .from("royalties_comissoes")
          .select("percentual, periodo_pagamento")
          .eq("livro_id", livro.id)
          .maybeSingle();

        setFormData({
          titulo: livro.titulo || "",
          autor_id: livro.autor_id || "",
          valor_capa: livro.valor_capa?.toString() || "",
          percentual_comissao: comissao?.percentual?.toString() || "",
          periodo_pagamento: (comissao?.periodo_pagamento as PeriodoPagamento) || "3_meses",
          is_active: livro.is_active ?? true,
        });
      } else {
        setFormData({
          titulo: "",
          autor_id: "",
          valor_capa: "",
          percentual_comissao: "",
          periodo_pagamento: "3_meses",
          is_active: true,
        });
      }
    };

    if (open) {
      loadData();
    }
  }, [livro, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const livroPayload = {
        titulo: formData.titulo.trim(),
        autor_id: formData.autor_id,
        valor_capa: parseFloat(formData.valor_capa) || 0,
        is_active: formData.is_active,
      };

      let livroId = livro?.id;

      if (livro?.id) {
        const { error } = await supabase
          .from("royalties_livros")
          .update(livroPayload)
          .eq("id", livro.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("royalties_livros")
          .insert(livroPayload)
          .select("id")
          .single();

        if (error) throw error;
        livroId = data.id;
      }

      // Handle commission - upsert based on livro_id (one-to-one relationship)
      if (formData.percentual_comissao && livroId) {
        const comissaoPayload = {
          livro_id: livroId,
          percentual: parseFloat(formData.percentual_comissao),
          periodo_pagamento: formData.periodo_pagamento as PeriodoPagamento,
        };

        // Check if commission exists
        const { data: existingComissao } = await supabase
          .from("royalties_comissoes")
          .select("id")
          .eq("livro_id", livroId)
          .maybeSingle();

        if (existingComissao) {
          const { error: updateError } = await supabase
            .from("royalties_comissoes")
            .update({
              percentual: parseFloat(formData.percentual_comissao),
              periodo_pagamento: formData.periodo_pagamento as PeriodoPagamento,
            })
            .eq("id", existingComissao.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from("royalties_comissoes")
            .insert(comissaoPayload);

          if (insertError) throw insertError;
        }
      }

      toast({ title: livro ? "Livro atualizado com sucesso!" : "Livro cadastrado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["royalties-livros"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar livro:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const periodoLabels: Record<PeriodoPagamento, string> = {
    "1_mes": "Mensal",
    "3_meses": "Trimestral",
    "6_meses": "Semestral",
    "1_ano": "Anual",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {livro ? "Editar Livro" : "Novo Livro"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="autor_id">Autor *</Label>
            <Select
              value={formData.autor_id}
              onValueChange={(value) => setFormData({ ...formData, autor_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o autor" />
              </SelectTrigger>
              <SelectContent>
                {autores.map((autor) => (
                  <SelectItem key={autor.id} value={autor.id}>
                    {autor.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor_capa">Valor de Capa (R$) *</Label>
            <Input
              id="valor_capa"
              type="number"
              step="0.01"
              min="0"
              value={formData.valor_capa}
              onChange={(e) => setFormData({ ...formData, valor_capa: e.target.value })}
              required
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Configuração de Comissão</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="percentual_comissao">Percentual (%)</Label>
                <Input
                  id="percentual_comissao"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.percentual_comissao}
                  onChange={(e) => setFormData({ ...formData, percentual_comissao: e.target.value })}
                  placeholder="Ex: 10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="periodo_pagamento">Período de Pagamento</Label>
                <Select
                  value={formData.periodo_pagamento}
                  onValueChange={(value: PeriodoPagamento) => 
                    setFormData({ ...formData, periodo_pagamento: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(periodoLabels) as PeriodoPagamento[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {periodoLabels[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Livro ativo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : livro ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
