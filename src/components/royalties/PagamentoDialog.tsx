import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface PagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PagamentoDialog({ open, onOpenChange }: PagamentoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    autor_id: "",
    valor_total: "",
    data_prevista: format(new Date(), "yyyy-MM-dd"),
    observacoes: "",
  });

  const [vendasPendentes, setVendasPendentes] = useState<any[]>([]);

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
    const loadVendasPendentes = async () => {
      if (!formData.autor_id) {
        setVendasPendentes([]);
        setFormData(prev => ({ ...prev, valor_total: "" }));
        return;
      }

      // Get books by this author first
      const { data: livrosAutor, error: livrosError } = await supabase
        .from("royalties_livros")
        .select("id")
        .eq("autor_id", formData.autor_id);

      if (livrosError || !livrosAutor?.length) {
        setVendasPendentes([]);
        setFormData(prev => ({ ...prev, valor_total: "0" }));
        return;
      }

      const livroIds = livrosAutor.map(l => l.id);

      const { data, error } = await supabase
        .from("royalties_vendas")
        .select(`
          id,
          quantidade,
          valor_comissao_total,
          data_venda,
          royalties_livros (titulo)
        `)
        .in("livro_id", livroIds)
        .is("pagamento_id", null)
        .order("data_venda");

      if (error) {
        console.error("Erro ao carregar vendas:", error);
        return;
      }

      setVendasPendentes(data || []);
      
      const total = (data || []).reduce((sum, v) => sum + (v.valor_comissao_total || 0), 0);
      setFormData(prev => ({ ...prev, valor_total: total.toFixed(2) }));
    };

    loadVendasPendentes();
  }, [formData.autor_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const valorTotal = parseFloat(formData.valor_total);
      
      if (valorTotal <= 0) {
        throw new Error("Não há vendas pendentes para este autor");
      }

      // Create payment
      const { data: pagamento, error: pagamentoError } = await supabase
        .from("royalties_pagamentos")
        .insert({
          autor_id: formData.autor_id,
          valor_total: valorTotal,
          data_prevista: formData.data_prevista,
          observacoes: formData.observacoes || null,
          status: "pendente",
        })
        .select("id")
        .single();

      if (pagamentoError) throw pagamentoError;

      // Link sales to payment
      const vendaIds = vendasPendentes.map(v => v.id);
      if (vendaIds.length > 0) {
        const { error: vendaError } = await supabase
          .from("royalties_vendas")
          .update({ pagamento_id: pagamento.id })
          .in("id", vendaIds);

        if (vendaError) throw vendaError;
      }

      toast({ title: "Pagamento criado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["royalties-pagamentos"] });
      queryClient.invalidateQueries({ queryKey: ["royalties-vendas"] });
      onOpenChange(false);
      
      // Reset form
      setFormData({
        autor_id: "",
        valor_total: "",
        data_prevista: format(new Date(), "yyyy-MM-dd"),
        observacoes: "",
      });
    } catch (error: any) {
      console.error("Erro ao criar pagamento:", error);
      toast({
        title: "Erro ao criar pagamento",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {formData.autor_id && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Vendas Pendentes</h4>
              {vendasPendentes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma venda pendente para este autor.
                </p>
              ) : (
                <div className="space-y-2">
                  {vendasPendentes.slice(0, 5).map((venda) => (
                    <div key={venda.id} className="flex justify-between text-sm">
                      <span className="truncate max-w-[200px]">
                        {venda.royalties_livros?.titulo} ({venda.quantidade} un.)
                      </span>
                      <span>{formatCurrency(venda.valor_comissao_total)}</span>
                    </div>
                  ))}
                  {vendasPendentes.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{vendasPendentes.length - 5} vendas
                    </p>
                  )}
                  <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                    <span>Total:</span>
                    <span className="text-primary">{formatCurrency(parseFloat(formData.valor_total) || 0)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="data_prevista">Data Prevista *</Label>
            <Input
              id="data_prevista"
              type="date"
              value={formData.data_prevista}
              onChange={(e) => setFormData({ ...formData, data_prevista: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || vendasPendentes.length === 0}
            >
              {loading ? "Criando..." : "Criar Pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
