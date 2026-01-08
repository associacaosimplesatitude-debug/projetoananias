import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Truck, DollarSign, Clock, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrcamentoFrete {
  id: string;
  cliente_id: string;
  cliente?: { nome_igreja: string };
  peso_total_kg: number;
  valor_com_desconto: number;
  status: string;
  transportadora_nome: string | null;
  valor_frete: number | null;
  prazo_entrega: string | null;
  observacoes: string | null;
  created_at: string;
}

interface AdicionarFreteOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamento: OrcamentoFrete | null;
  onSuccess: () => void;
}

export function AdicionarFreteOrcamentoDialog({
  open,
  onOpenChange,
  orcamento,
  onSuccess,
}: AdicionarFreteOrcamentoDialogProps) {
  const [transportadora, setTransportadora] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSalvar = async () => {
    if (!orcamento) return;

    if (!transportadora.trim()) {
      toast.error("Informe o nome da transportadora");
      return;
    }

    const valor = parseFloat(valorFrete.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      toast.error("Informe um valor válido para o frete");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("vendedor_orcamentos_frete")
        .update({
          transportadora_nome: transportadora.trim(),
          valor_frete: valor,
          prazo_entrega: prazoEntrega.trim() || null,
          observacoes: observacoes.trim() || null,
          status: "orcamento_recebido",
        })
        .eq("id", orcamento.id);

      if (error) throw error;

      toast.success("Frete adicionado com sucesso!");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar frete:", error);
      toast.error("Erro ao salvar frete");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTransportadora("");
    setValorFrete("");
    setPrazoEntrega("");
    setObservacoes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Adicionar Frete
          </DialogTitle>
        </DialogHeader>

        {orcamento && (
          <div className="bg-muted/50 p-3 rounded-lg text-sm mb-4">
            <p className="font-medium">{orcamento.cliente?.nome_igreja}</p>
            <p className="text-muted-foreground">
              {orcamento.peso_total_kg.toFixed(2)}kg • R$ {orcamento.valor_com_desconto.toFixed(2)}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transportadora" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Nome da Transportadora *
            </Label>
            <Input
              id="transportadora"
              placeholder="Ex: Jamef, Braspress, TNT..."
              value={transportadora}
              onChange={(e) => setTransportadora(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valor do Frete (R$) *
            </Label>
            <Input
              id="valor"
              placeholder="Ex: 85,00"
              value={valorFrete}
              onChange={(e) => setValorFrete(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prazo" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Prazo de Entrega
            </Label>
            <Input
              id="prazo"
              placeholder="Ex: 5-7 dias úteis"
              value={prazoEntrega}
              onChange={(e) => setPrazoEntrega(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Observações
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Anotações internas sobre o frete..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Frete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
