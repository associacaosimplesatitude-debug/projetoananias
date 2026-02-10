import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface VendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendaDialog({ open, onOpenChange }: VendaDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [isCompraAutor, setIsCompraAutor] = useState(false);
  const [formData, setFormData] = useState({
    livro_id: "",
    quantidade: "",
    valor_unitario: "",
    data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_fim: format(new Date(), "yyyy-MM-dd"),
    observacao: "",
  });

  const [selectedLivro, setSelectedLivro] = useState<any>(null);

  const { data: livros = [] } = useQuery({
    queryKey: ["royalties-livros-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("royalties_livros")
        .select(`
          id, 
          titulo, 
          valor_capa,
          autor_id,
          royalties_comissoes (percentual)
        `)
        .eq("is_active", true)
        .order("titulo");
      
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (formData.livro_id) {
      const livro = livros.find((l: any) => l.id === formData.livro_id);
      setSelectedLivro(livro);
      if (livro) {
        setFormData(prev => ({ 
          ...prev, 
          valor_unitario: livro.valor_capa?.toString() || "" 
        }));
      }
    }
  }, [formData.livro_id, livros]);

  const getComissaoPercentual = () => {
    if (!selectedLivro?.royalties_comissoes) return 0;
    return selectedLivro.royalties_comissoes?.percentual || 0;
  };

  const calcularComissaoUnitaria = () => {
    const valorUnitario = parseFloat(formData.valor_unitario) || 0;
    const percentual = getComissaoPercentual();
    return (valorUnitario * percentual) / 100;
  };

  const calcularComissaoTotal = () => {
    const quantidade = parseInt(formData.quantidade) || 0;
    return quantidade * calcularComissaoUnitaria();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!selectedLivro) {
        throw new Error("Selecione um livro");
      }

      const quantidade = parseInt(formData.quantidade);
      const valorUnitario = parseFloat(formData.valor_unitario);
      const valorComissaoUnitario = calcularComissaoUnitaria();
      const valorComissaoTotal = calcularComissaoTotal();

      // Formata o período na observação
      const dataInicioFormatada = format(new Date(formData.data_inicio + "T00:00:00"), "dd/MM/yyyy");
      const dataFimFormatada = format(new Date(formData.data_fim + "T00:00:00"), "dd/MM/yyyy");
      const observacaoCompleta = `Período: ${dataInicioFormatada} a ${dataFimFormatada}${formData.observacao ? ` - ${formData.observacao}` : ""}`;

      const payload = {
        livro_id: formData.livro_id,
        quantidade,
        valor_unitario: valorUnitario,
        valor_comissao_unitario: isCompraAutor ? 0 : valorComissaoUnitario,
        valor_comissao_total: isCompraAutor ? 0 : valorComissaoTotal,
        data_venda: formData.data_fim,
        observacao: observacaoCompleta,
        is_compra_autor: isCompraAutor,
      };

      const { error } = await supabase
        .from("royalties_vendas")
        .insert(payload);

      if (error) throw error;

      toast({ title: "Venda registrada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["royalties-vendas"] });
      onOpenChange(false);
      
      // Reset form
      setFormData({
        livro_id: "",
        quantidade: "",
        valor_unitario: "",
        data_inicio: format(new Date(), "yyyy-MM-dd"),
        data_fim: format(new Date(), "yyyy-MM-dd"),
        observacao: "",
      });
      setSelectedLivro(null);
      setIsCompraAutor(false);
    } catch (error: any) {
      console.error("Erro ao registrar venda:", error);
      toast({
        title: "Erro ao registrar",
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
          <DialogTitle>Registrar Venda Manual</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Use para registrar vendas retroativas ou não sincronizadas do Bling
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="livro_id">Livro *</Label>
            <Select
              value={formData.livro_id}
              onValueChange={(value) => setFormData({ ...formData, livro_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o livro" />
              </SelectTrigger>
              <SelectContent>
                {livros.map((livro: any) => (
                  <SelectItem key={livro.id} value={livro.id}>
                    {livro.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Período das Vendas *</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="data_inicio" className="text-xs text-muted-foreground">De</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="data_fim" className="text-xs text-muted-foreground">Até</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                value={formData.quantidade}
                onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_unitario">Valor Unitário (R$) *</Label>
              <Input
                id="valor_unitario"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_unitario}
                onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_compra_autor"
              checked={isCompraAutor}
              onCheckedChange={(checked) => setIsCompraAutor(checked === true)}
            />
            <Label htmlFor="is_compra_autor" className="text-sm font-normal cursor-pointer">
              Compra do Autor (sem royalties)
            </Label>
          </div>

          {isCompraAutor && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ Compras feitas pelo próprio autor não geram royalties. A comissão será registrada como R$ 0,00.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação (opcional)</Label>
            <Input
              id="observacao"
              placeholder="Ex: Referente a feira do livro 2024"
              value={formData.observacao}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
            />
          </div>

          {selectedLivro && formData.quantidade && formData.valor_unitario && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Valor Total:</span>
                <span className="font-medium">
                  {formatCurrency(
                    (parseInt(formData.quantidade) || 0) * 
                    (parseFloat(formData.valor_unitario) || 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Comissão ({getComissaoPercentual()}%):</span>
                <span className={`font-medium ${isCompraAutor ? "line-through text-muted-foreground" : "text-primary"}`}>
                  {formatCurrency(isCompraAutor ? 0 : calcularComissaoTotal())}
                </span>
              </div>
              {isCompraAutor && (
                <p className="text-xs text-amber-600">Compra do autor — sem royalties</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Registrar Venda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
